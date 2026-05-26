"use client";

import { Modal } from "@/components/ui/modal";
import { StepRattachementsPm } from "@/components/pp/StepRattachementsPm";

type Props = {
  open: boolean;
  onClose: () => void;
  ppId: string;
  ppNom: string;
};

export function RattachementsPmModal({ open, onClose, ppId, ppNom }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rattacher à une organisation"
      subtitle={ppNom}
      size="lg"
    >
      <StepRattachementsPm ppId={ppId} ppNom={ppNom} onDone={onClose} />
    </Modal>
  );
}
