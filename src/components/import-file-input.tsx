import React, { useCallback, MutableRefObject } from 'react';
import FileInput from './file-input';

type ImportFileInputProps = {
  autoOpen?: boolean;
  onCancel?: () => void;
  selectImportFile: (file: File) => void;
  fileName?: string;
  fileRef: MutableRefObject<File | null>;
};

function ImportFileInput({
  autoOpen,
  onCancel,
  selectImportFile,
  fileName,
  fileRef,
}: ImportFileInputProps) {
  const handleChooseFile = useCallback(
    (files: File[]) => {
      if (files.length > 0) {
        void selectImportFile(files[0]);
        fileRef.current = files[0];
      } else if (typeof onCancel === 'function') {
        onCancel();
        fileRef.current = null;
      }
    },
    [onCancel, selectImportFile]
  );

  const values = fileName ? [fileName] : undefined;

  return (
    <FileInput
      autoOpen={autoOpen}
      label="Import file:"
      id="import-file"
      onChange={handleChooseFile}
      values={values}
      variant="small"
      mode="open"
      title="Select JSON or CSV to import"
      buttonLabel="Select"
    />
  );
}

export { ImportFileInput };
