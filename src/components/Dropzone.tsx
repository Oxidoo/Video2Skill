"use client";

import { useCallback } from "react";
import { useDropzone } from "react-dropzone";

export function Dropzone({
  onFile,
  disabled,
  file,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
  file: File | null;
}) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted[0]) onFile(accepted[0]);
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    multiple: false,
    accept: {
      "video/mp4": [".mp4"],
      "video/quicktime": [".mov"],
      "video/webm": [".webm"],
      "video/x-matroska": [".mkv"],
    },
  });

  return (
    <div
      {...getRootProps()}
      className={`cursor-pointer rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
        isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:border-gray-400"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
    >
      <input {...getInputProps()} />
      {file ? (
        <div>
          <p className="font-medium text-gray-900">{file.name}</p>
          <p className="mt-1 text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
        </div>
      ) : (
        <div>
          <p className="font-medium text-gray-700">
            Dépose ta vidéo ici, ou clique pour parcourir
          </p>
          <p className="mt-1 text-sm text-gray-500">Formats acceptés : mp4, mov, webm, mkv</p>
        </div>
      )}
    </div>
  );
}
