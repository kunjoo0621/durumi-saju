"use client";

import Spinner from "./Spinner";

interface ButtonSpinnerProps {
  message: string;
}

export default function ButtonSpinner({ message }: ButtonSpinnerProps) {
  return (
    <span className="flex items-center justify-center gap-2">
      <Spinner size="sm" />
      {message}
    </span>
  );
}
