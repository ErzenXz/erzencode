/**
 * Custom hook for managing modal state in the Terminal UI.
 * Handles modal visibility and selection navigation.
 */

import { useState, useCallback } from "react";
import type { ModalType } from "../types/ui-state.js";

/**
 * Return type for the useModalState hook.
 */
export interface UseModalStateReturn {
  /** Currently active modal */
  activeModal: ModalType;
  /** Current selection index within the modal */
  selectionIndex: number;
  /** Open a modal */
  openModal: (modal: ModalType) => void;
  /** Close the current modal */
  closeModal: () => void;
  /** Set the selection index */
  setSelectionIndex: (index: number) => void;
  /** Navigate selection up or down */
  navigateSelection: (direction: "up" | "down", maxItems: number) => void;
  /** Check if a modal is open */
  isModalOpen: boolean;
}

/**
 * Hook for managing modal state.
 * @param initialModal - Initial modal state
 * @returns Modal state and manipulation functions
 */
export function useModalState(
  initialModal: ModalType = "none"
): UseModalStateReturn {
  const [activeModal, setActiveModal] = useState<ModalType>(initialModal);
  const [selectionIndex, setSelectionIndexState] = useState(0);

  const openModal = useCallback((modal: ModalType) => {
    setActiveModal(modal);
    setSelectionIndexState(0);
  }, []);

  const closeModal = useCallback(() => {
    setActiveModal("none");
    setSelectionIndexState(0);
  }, []);

  const setSelectionIndex = useCallback((index: number) => {
    setSelectionIndexState(index);
  }, []);

  const navigateSelection = useCallback(
    (direction: "up" | "down", maxItems: number) => {
      setSelectionIndexState((prev) => {
        if (direction === "up") {
          return Math.max(0, prev - 1);
        } else {
          return Math.min(maxItems - 1, prev + 1);
        }
      });
    },
    []
  );

  const isModalOpen = activeModal !== "none";

  return {
    activeModal,
    selectionIndex,
    openModal,
    closeModal,
    setSelectionIndex,
    navigateSelection,
    isModalOpen,
  };
}
