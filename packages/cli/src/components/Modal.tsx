import React from "react";
import { Box, Text, useInput } from "ink";
import figures from "figures";

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  width?: number;
  footer?: React.ReactNode;
  variant?: "default" | "info" | "warning" | "error" | "success";
}

const variantColors = {
  default: "cyan",
  info: "blue",
  warning: "yellow",
  error: "red",
  success: "green",
};

export const Modal: React.FC<ModalProps> = ({
  title,
  children,
  onClose,
  width = 60,
  footer,
  variant = "default",
}) => {
  useInput((input, key) => {
    if (key.escape && onClose) {
      onClose();
    }
  });

  const borderColor = variantColors[variant];

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={borderColor}
      paddingX={2}
      paddingY={1}
      width={width}
    >
      {/* Title Bar */}
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={borderColor}>
          {figures.pointer} {title}
        </Text>
        {onClose && (
          <Text color="gray" dimColor>
            ESC to close
          </Text>
        )}
      </Box>

      {/* Content */}
      <Box flexDirection="column">{children}</Box>

      {/* Footer */}
      {footer && (
        <Box marginTop={1} borderTop borderColor="gray" paddingTop={1}>
          {footer}
        </Box>
      )}
    </Box>
  );
};

interface MenuOption {
  label: string;
  value: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

interface MenuModalProps {
  title: string;
  options: MenuOption[];
  selectedIndex: number;
  onSelect: (value: string) => void;
  onClose: () => void;
  footer?: string;
}

export const MenuModal: React.FC<MenuModalProps> = ({
  title,
  options,
  selectedIndex,
  onSelect,
  onClose,
  footer,
}) => {
  const [currentIndex, setCurrentIndex] = React.useState(selectedIndex);

  useInput((input, key) => {
    if (key.escape) {
      onClose();
      return;
    }

    if (key.upArrow) {
      setCurrentIndex((prev) => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setCurrentIndex((prev) => Math.min(options.length - 1, prev + 1));
    } else if (key.return) {
      const selected = options[currentIndex];
      if (selected && !selected.disabled) {
        onSelect(selected.value);
      }
    }
  });

  return (
    <Modal
      title={title}
      onClose={onClose}
      width={70}
      footer={
        footer ? (
          <Text color="gray" dimColor>
            {footer}
          </Text>
        ) : undefined
      }
    >
      <Box flexDirection="column">
        {options.map((option, idx) => {
          const isSelected = idx === currentIndex;
          const isDisabled = option.disabled ?? false;

          return (
            <Box
              key={option.value}
              paddingX={1}
              paddingY={0}
              backgroundColor={isSelected ? "blue" : undefined}
            >
              <Box gap={1} width="100%">
                <Text bold={isSelected} color={isDisabled ? "gray" : "white"}>
                  {isSelected ? figures.pointer : " "}
                </Text>
                {option.icon && (
                  <Text color={isDisabled ? "gray" : "yellow"}>
                    {option.icon}
                  </Text>
                )}
                <Text
                  bold={isSelected}
                  color={isDisabled ? "gray" : isSelected ? "white" : undefined}
                >
                  {option.label}
                </Text>
                {option.description && (
                  <Text color="gray" dimColor>
                    - {option.description}
                  </Text>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Modal>
  );
};
