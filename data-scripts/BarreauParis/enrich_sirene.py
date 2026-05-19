#!/usr/bin/env python3
"""Enrichissement SIRENE des structures issues de l'extraction Barreau de Paris.

Lit le CSV contacts, extrait les structures uniques, les mappe depuis
le stock local SIRENE (sirene_local.db), et génère le CSV structures.

Prérequis : avoir construit l'index local avec sirene/build_sirene_index.py
"""

import csv
import os
import re
import sqlite3
import unicodedata

import requests
import xlrd

_DIR   = os.path.dirname(os.path.abspath(__file__))
ROOT   = os.path.dirname(_DIR)

INPUT  = os.path.join(ROOT, 'output', 'BarreauParis', 'extraction_barreau_paris.csv')
OUTPUT = os.path.join(ROOT, 'output', 'BarreauParis', 'extraction_structures_barreau_paris.csv')
DB     = os.path.join(ROOT, 'sirene_local.db')
SOURCE = 'BARREAU_PARIS+SIRENE'

CSV_HEADERS = [
    'raison_sociale',
    'siret',
    'siren',
    'type_structure',
    'categorie_entrepri',
    'secteur_activite',
    'site_web',
    'source_origine',
    'rue',
    'complement_adres',
    'code_postal',
    'ville',
    'pays',
    'sirene_trouve',
    'match_strategy',
]


# ──────────────────────────────────────────────────────────────────────────────
# Normalisation
# ──────────────────────────────────────────────────────────────────────────────

def normalize(s) -> str:
    if not s or not isinstance(s, str):
        return ''
    s = s.strip().lower()
    s = unicodedata.normalize('NFD', s)
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    s = re.sub(r'[^\w\s]', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


def fts_escape(q: str) -> str:
    return re.sub(r'["\(\)\-\*\.\~\:]+', ' ', q).strip()


def token_overlap(a: str, b: str) -> float:
    ta, tb = set(a.split()), set(b.split())
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / max(len(ta), len(tb))


# ──────────────────────────────────────────────────────────────────────────────
# Stratégies de matching (identique à reenrich_structures_sirene.py)
# ──────────────────────────────────────────────────────────────────────────────

_SUFFIXES = {
    'avocat', 'avocats', 'notaire', 'notaires', 'conseil', 'conseils',
    'attorney', 'attorneys', 'lawyer', 'lawyers', 'law',
    'juriste', 'juristes', 'associe', 'associes',
    'et', 'de', 'la', 'le', 'les', 'du', 'des',
}
_STOP = _SUFFIXES | {
    'cabinet', 'etude', 'groupe', 'societe', 'association',
    'du', 'de', 'la', 'le', 'les', 'et', 'en',
}
_LEGAL_FORMS = {
    'selarl', 'scp', 'aarpi', 'sas', 'sarl', 'eurl', 'selas', 'selafa',
    'sei', 'sep', 'sci', 'snc', 'sa', 'ei', 'sasu', 'earl',
}
_THRESHOLD = 0.45
_TRAILING_PAREN = re.compile(r'\s*\([^)]{1,30}\)\s*$')


def _strip_suffixes(tokens: list) -> list:
    t = list(tokens)
    while t and t[-1] in _SUFFIXES:
        t.pop()
    return t


def _distinctive(tokens: list) -> list:
    return [t for t in tokens if len(t) > 3 and t not in _STOP]


def generate_queries(name: str) -> list:
    clean_name = _TRAILING_PAREN.sub('', name).strip()

    n = normalize(name)
    if not n:
        return []
    tokens = n.split()
    queries = []

    # If a trailing (TYPE) suffix was present, try the clean name first
    if clean_name != name:
        nc = normalize(clean_name)
        if nc:
            queries.append(('exact_clean', 'exact', nc))
            qc = fts_escape(nc)
            if qc:
                queries.append(('fts_clean', 'fts', qc))

    queries.append(('exact', 'exact', n))

    q = fts_escape(n)
    if q:
        queries.append(('fts_all', 'fts', q))

    t_no_sfx = _strip_suffixes(tokens)
    if t_no_sfx != tokens and len(t_no_sfx) >= 2:
        n2 = ' '.join(t_no_sfx)
        queries.append(('exact_no_suffix', 'exact', n2))
        q2 = fts_escape(n2)
        if q2:
            queries.append(('fts_no_suffix', 'fts', q2))

    if tokens and tokens[0] in _LEGAL_FORMS and len(tokens) >= 2:
        n3 = ' '.join(tokens[1:])
        queries.append(('exact_no_form', 'exact', normalize(n3)))
        q3 = fts_escape(normalize(n3))
        if q3:
            queries.append(('fts_no_form', 'fts', q3))

    t_dist = _distinctive(tokens)
    if t_dist and len(t_dist) < len(tokens) and len(t_dist) >= 1:
        qd = fts_escape(' '.join(t_dist))
        if qd:
            queries.append(('fts_distinctive', 'fts', qd))

    if 2 <= len(tokens) <= 4:
        meaningful = [t for t in tokens if t not in _SUFFIXES]
        if 2 <= len(meaningful) <= 3:
            rev = list(reversed(meaningful))
            if rev != meaningful:
                nr = ' '.join(rev)
                queries.append(('exact_reversed', 'exact', nr))
                qr = fts_escape(nr)
                if qr:
                    queries.append(('fts_reversed', 'fts', qr))

    if '/' in name:
        for part in name.split('/'):
            pn = normalize(part)
            if len(pn) > 4:
                queries.append(('fts_part', 'fts', fts_escape(pn)))

    return queries


_Q_EXACT = '''
    SELECT ul.siren, ul.denomination, ul.name_norm, ul.cat_juridique, ul.naf,
           e.siret, e.cp, e.ville, e.rue
    FROM unite_legale ul
    LEFT JOIN etablissement_siege e ON ul.siren = e.siren
    WHERE ul.name_norm = ?
    LIMIT 1
'''

_Q_FTS = '''
    SELECT ul.siren, ul.denomination, ul.name_norm, ul.cat_juridique, ul.naf,
           e.siret, e.cp, e.ville, e.rue
    FROM ul_fts
    JOIN unite_legale ul ON ul_fts.siren = ul.siren
    LEFT JOIN etablissement_siege e ON ul.siren = e.siren
    WHERE ul_fts.name_norm MATCH ?
    ORDER BY ul_fts.rank
    LIMIT 10
'''


def _row_to_dict(row) -> dict:
    siren, denomination, name_norm, cat_juridique, naf, siret, cp, ville, rue = row
    cj = str(int(cat_juridique)) if cat_juridique and str(cat_juridique).strip() not in ('', 'None') else ''
    if cj and len(cj) < 4:
        cj = cj.zfill(4)
    return {
        'siret':              siret or '',
        'siren':              siren or '',
        'type_structure':     denomination or '',
        'categorie_entrepri': cj,
        'secteur_activite':   naf or '',
        'rue':                rue or '',
        'code_postal':        cp or '',
        'ville':              ville or '',
    }


def lookup(name: str, con: sqlite3.Connection):
    clean_name = _TRAILING_PAREN.sub('', name).strip()
    n_orig = normalize(clean_name)
    for strategy, mode, query in generate_queries(name):
        if mode == 'exact':
            row = con.execute(_Q_EXACT, (query,)).fetchone()
            if row and token_overlap(n_orig, row[2]) >= _THRESHOLD:
                return _row_to_dict(row), strategy
        elif mode == 'fts':
            try:
                candidates = con.execute(_Q_FTS, (query,)).fetchall()
            except sqlite3.OperationalError:
                continue
            best, best_score = None, 0.0
            for c in candidates:
                score = token_overlap(n_orig, c[2])
                if score > best_score:
                    best_score, best = score, c
            if best and best_score >= _THRESHOLD:
                return _row_to_dict(best), strategy
    return None, None


def empty_row(name: str) -> dict:
    return {
        'raison_sociale':     name,
        'siret':              '',
        'siren':              '',
        'type_structure':     '',
        'categorie_entrepri': '',
        'secteur_activite':   '',
        'site_web':           '',
        'source_origine':     SOURCE,
        'rue':                '',
        'complement_adres':   '',
        'code_postal':        '',
        'ville':              '',
        'pays':               'France',
        'sirene_trouve':      'non',
        'match_strategy':     '',
    }


# ──────────────────────────────────────────────────────────────────────────────
# Référentiels INSEE (NAF + Catégories Juridiques)
# ──────────────────────────────────────────────────────────────────────────────

_NAF_URL = 'https://www.insee.fr/fr/statistiques/fichier/2120875/int_courts_naf_rev_2.xls'
_CJ_URL  = 'https://www.insee.fr/fr/statistiques/fichier/2028129/cj_septembre_2022.xls'


def _load_naf_labels() -> dict:
    print('Téléchargement du référentiel NAF...')
    resp = requests.get(_NAF_URL, timeout=30)
    resp.raise_for_status()
    wb = xlrd.open_workbook(file_contents=resp.content)
    ws = wb.sheet_by_index(0)
    naf = {}
    for i in range(1, ws.nrows):
        code  = str(ws.cell_value(i, 1)).strip()
        label = str(ws.cell_value(i, 3)).strip()
        if re.match(r'\d{2}\.\d{2}[A-Z]', code) and label:
            naf[code] = label
    print(f'  {len(naf)} codes NAF chargés.')
    return naf


def _load_cj_labels() -> dict:
    print('Téléchargement du référentiel Catégories Juridiques...')
    resp = requests.get(_CJ_URL, timeout=30)
    resp.raise_for_status()
    wb = xlrd.open_workbook(file_contents=resp.content)
    ws = wb.sheet_by_index(2)
    cj = {}
    for i in range(4, ws.nrows):
        code  = str(ws.cell_value(i, 0)).strip().replace('.0', '')
        label = str(ws.cell_value(i, 1)).strip()
        if re.match(r'^\d{4}$', code) and label:
            cj[code] = label
    print(f'  {len(cj)} codes CJ chargés.')
    return cj


def _apply_labels(row: dict, naf_labels: dict, cj_labels: dict) -> None:
    naf_raw = (row.get('secteur_activite') or '').split(' - ')[0].strip()
    if naf_raw and naf_raw in naf_labels:
        row['secteur_activite'] = f"{naf_raw} - {naf_labels[naf_raw]}"

    cj_raw = (row.get('categorie_entrepri') or '').strip()
    if cj_raw and re.match(r'^\d{4}$', cj_raw) and cj_raw in cj_labels:
        row['categorie_entrepri'] = cj_labels[cj_raw]


# ──────────────────────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────────────────────

def main() -> None:
    if not os.path.exists(DB):
        raise FileNotFoundError(
            f'Index SQLite introuvable : {DB}\n'
            'Lancez d\'abord : python3 sirene/build_sirene_index.py'
        )

    if not os.path.exists(INPUT):
        raise FileNotFoundError(
            f'Fichier contacts introuvable : {INPUT}\n'
            'Lancez d\'abord : python3 barreau-paris/extract.py --token <TOKEN>'
        )

    print(f'Lecture de {INPUT}...')
    with open(INPUT, encoding='utf-8-sig') as f:
        reader = csv.DictReader(f, delimiter=';')
        contacts = list(reader)

    structures: set = set()
    for row in contacts:
        cell = (row.get('Structure(s)') or '').strip()
        for s in cell.split(' | '):
            s = s.strip()
            if s:
                structures.add(s)

    print(f'{len(structures)} structures uniques à enrichir.')

    print()
    naf_labels = _load_naf_labels()
    cj_labels  = _load_cj_labels()

    con = sqlite3.connect(DB)
    con.execute('PRAGMA query_only = ON')
    con.execute('PRAGMA cache_size = -131072')

    results: list = []
    found = 0
    strategy_counts: dict = {}

    for i, name in enumerate(sorted(structures), start=1):
        data, strategy = lookup(name, con)
        if data:
            row = empty_row(name)
            row.update(data)
            row['sirene_trouve']  = 'oui'
            row['match_strategy'] = strategy
            found += 1
            strategy_counts[strategy] = strategy_counts.get(strategy, 0) + 1
        else:
            row = empty_row(name)

        _apply_labels(row, naf_labels, cj_labels)
        results.append(row)

        if i % 500 == 0:
            pct = found * 100 // i
            print(f'  {i:5d}/{len(structures)} | trouvés: {found} ({pct}%)')

    con.close()

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADERS, delimiter=';', extrasaction='ignore')
        writer.writeheader()
        writer.writerows(results)

    pct = found * 100 // len(structures) if structures else 0
    print(f'\nCSV structures : {OUTPUT}')
    print(f'Résultat : {found}/{len(structures)} trouvés sur SIRENE ({pct}%)')
    if strategy_counts:
        print('Stratégies :')
        for s, c in sorted(strategy_counts.items(), key=lambda x: -x[1]):
            print(f'  {s:25s}: {c}')


if __name__ == '__main__':
    main()
