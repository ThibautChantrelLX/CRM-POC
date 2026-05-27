"use client";

import { Modal } from "@/components/ui/modal";
import { StepRattachements } from "@/components/pm/StepRattachements";

type Props = {
  open: boolean;
  onClose: () => void;
  pmId: string;
  pmNom: string;
  pmNomDomaine: string | null;
};

export function RattachementsModal({ open, onClose, pmId, pmNom, pmNomDomaine }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rattacher des personnes physiques"
      subtitle={pmNom}
      size="lg"
    >
      <StepRattachements
        pmId={pmId}
        pmNom={pmNom}
        pmNomDomaine={pmNomDomaine}
        onDone={onClose}
        showCreatedBanner={false}
      />
    </Modal>
  );
}
