import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import path from 'path';
import { css, cx } from '@leafygreen-ui/emotion';
import { palette } from '@leafygreen-ui/palette';
import { spacing } from '@leafygreen-ui/tokens';
import { useDarkMode } from '../../compass/packages/compass-components/src/hooks/use-theme';

import {
  Button,
  Icon,
  IconButton,
  Label,
  Link,
  Description,
} from '../../compass/packages/compass-components/src/components/leafygreen';
import { ElectronFileDialogOptions, FileInputBackend } from '../../compass/packages/compass-components/src/components/file-input'

const { base: redBaseColor } = palette.red;

const containerStyles = css({
  marginTop: spacing[200],
  marginBottom: spacing[200],
  marginRight: 'auto',
  marginLeft: 'auto',
});

const formItemSmallStyles = css({
  display: 'flex',
  alignItems: 'center',
  gap: spacing[100],
});

const formItemHorizontalStyles = css({
  display: 'flex',
});

const removeFileLineStyles = css({
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
});

const removeFileButtonStyles = css({
  marginLeft: spacing[100],
});

const buttonSmallStyles = css({
  border: 'none',
  background: 'none',
  fontWeight: 'normal',
  marginLeft: spacing[200],

  '&:hover': {
    background: 'none',
    boxShadow: 'none',
  },
  '&:active': {
    background: 'none',
    boxShadow: 'none',
  },
});

const buttonDefaultStyles = css({
  // We !important here to override the LeafyGreen button width
  // that is applied after this.
  width: '100% !important',
});

const buttonTextStyle = css({
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  wordBreak: 'normal',
  whiteSpace: 'nowrap',
});

const errorMessageStyles = css({
  color: `${redBaseColor} !important`,
});

const labelHorizontalStyles = css({
  width: '90%',
  paddingRight: spacing[400],
});

const optionalLabelStyles = css({
  color: palette.gray.base,
  marginTop: spacing[100],
  fontStyle: 'italic',
  fontWeight: 'normal',
  fontSize: 12,
});

const infoLinkStyles = css({
  '&:link, &:active, &:hover': {
    textDecoration: 'none',
  },
});

const labelIconStyles = css({
  display: 'inline-block',
  verticalAlign: 'middle',
  fontSize: 'inherit',
  textRendering: 'auto',
  margin: '0 0 0 5px',
  cursor: 'pointer',
  color: palette.gray.light1,

  '&:link, &:active': {
    color: palette.gray.light1,
  },

  '&:link, &:active, &:hover': {
    textDecoration: 'none',
  },

  '&:hover': {
    color: palette.yellow.base,
  },
});

const disabledDescriptionLightStyles = css({
  color: palette.gray.dark1,
});

const disabledDescriptionDarkStyles = css({
  color: palette.gray.light1,
});

type FileInputVariant = 'default' | 'small' | 'vertical';



type FileChooserOptions = {
  multi?: boolean;
  mode: 'open' | 'save';
  accept?: string;
} & ElectronFileDialogOptions;

export const FileInputBackendContext = createContext<
  (() => FileInputBackend) | null
>(null);

// This hook is to create a new instance of the file input
// backend provided by the context.
function useFileInputBackend() {
  const fileInputBackendContext = useContext(FileInputBackendContext);

  const fileInputBackend = useRef<null | FileInputBackend>(
    fileInputBackendContext ? fileInputBackendContext() : null
  );

  return fileInputBackend.current;
}


function FileInput({
  autoOpen = false,
  id,
  label,
  dataTestId,
  onChange,
  disabled,
  optional = false,
  optionalMessage,
  error = false,
  errorMessage,
  variant = 'default',
  showFileOnNewLine = false,
  link,
  description,
  values,
  className,

  multi = false,
  mode = 'save',
  accept,
  title,
  defaultPath,
  filters,
  buttonLabel,
  properties,
}: {
  autoOpen?: boolean;
  id: string;
  label: string;
  dataTestId?: string;
  onChange: (files: File[]) => void;
  disabled?: boolean;
  optional?: boolean;
  optionalMessage?: string;
  error?: boolean;
  errorMessage?: string;
  variant?: FileInputVariant;
  link?: string;
  description?: string;
  showFileOnNewLine?: boolean;
  values?: string[];
  className?: string;
} & FileChooserOptions): React.ReactElement {
  const darkMode = useDarkMode();

  const inputRef = React.useRef<HTMLInputElement>(null);

  // To make components of Compass environment agnostic
  // (electron, browser, VSCode Webview), we use a backend context so that
  // the different environments can supply their own file system backends.
  const backend = useFileInputBackend();

  const buttonText = React.useMemo(() => {
    if (Array.isArray(values) && values.length > 0) {
      return values.map((file) => path.basename(file)).join(', ');
    }

    return multi ? 'Select files…' : 'Select a file…';
  }, [values, multi]);

  const onFilesChanged = React.useCallback(
    (evt: React.ChangeEvent<HTMLInputElement>) => {
      const fileList = Array.from(evt.currentTarget.files ?? []);
      onChange(fileList);
    },
    [onChange]
  );

  const handleOpenFileInput = useCallback(() => {
    if (disabled) return;
    if (backend) {
      backend.openFileChooser({
        multi,
        mode,
        accept,
        title,
        defaultPath,
        filters,
        buttonLabel,
        properties,
      });
    } else if (inputRef.current) {
      inputRef.current.click();
    }
  }, [
    disabled,
    backend,
    multi,
    mode,
    accept,
    title,
    defaultPath,
    filters,
    buttonLabel,
    properties,
  ]);

  const initialAutoOpen = useRef(() => {
    if (autoOpen) {
      handleOpenFileInput();
    }
  });
  useEffect(() => {
    initialAutoOpen.current();
  }, []);

  const renderDescription = (): React.ReactElement | null => {
    if (!link && !description) {
      return null;
    }
    if (!link) {
      return (
        <Description data-testid={'file-input-description'}>
          {description}
        </Description>
      );
    }
    return (
      <Link
        data-testid={'file-input-link'}
        href={link}
        className={cx(description ? infoLinkStyles : labelIconStyles)}
        hideExternalIcon={!description}
      >
        {description ?? ''}
      </Link>
    );
  };

  const valuesAsString = useMemo(() => JSON.stringify(values), [values]);

  const leftGlyph =
    variant === 'small' ? undefined : (
      <Icon glyph="AddFile" title={null} fill="currentColor" />
    );
  const rightGlyph =
    variant === 'small' ? (
      <Icon glyph="Edit" title={null} fill="currentColor" />
    ) : undefined;

  return (
    <div className={cx(containerStyles, className)}>
      <div
        className={cx({
          [formItemSmallStyles]: variant === 'small',
          [formItemHorizontalStyles]: variant === 'default',
        })}
      >
        <div
          className={cx({
            [labelHorizontalStyles]: variant === 'default',
          })}
        >
          <Label htmlFor={`${id}_file_input`} disabled={disabled}>
            <span
              className={cx({
                [darkMode
                  ? disabledDescriptionDarkStyles
                  : disabledDescriptionLightStyles]: disabled,
              })}
            >
              {label}
            </span>
          </Label>
          {optional && (
            <div className={optionalLabelStyles}>
              {optionalMessage ? optionalMessage : 'Optional'}
            </div>
          )}
          {renderDescription()}
        </div>
        <input
          data-testid={dataTestId ?? 'file-input'}
          ref={inputRef}
          id={`${id}_file_input`}
          name={id}
          type="file"
          multiple={multi}
          onChange={onFilesChanged}
          style={{ display: 'none' }}
          // Force a re-render when the values change so
          // the component is controlled by the prop.
          // This is also useful for testing.
          key={valuesAsString}
          data-filenames={valuesAsString}
          accept={accept}
        />
        <Button
          id={id}
          data-testid="file-input-button"
          className={
            variant === 'small' ? buttonSmallStyles : buttonDefaultStyles
          }
          disabled={disabled}
          onClick={handleOpenFileInput}
          title="Select a file"
          leftGlyph={leftGlyph}
          rightGlyph={rightGlyph}
        >
          <span className={buttonTextStyle}>{buttonText}</span>
        </Button>
      </div>
      {showFileOnNewLine &&
        values &&
        values.length > 0 &&
        values.map((value, index) => (
          <div className={removeFileLineStyles} key={value}>
            <div>{value}</div>
            <IconButton
              className={removeFileButtonStyles}
              aria-label="Remove file"
              onClick={() => {
                // const newValues = [...values];
                // newValues.splice(index, 1);
                // TODO:
                onChange([]);
              }}
            >
              <Icon glyph="X" />
            </IconButton>
          </div>
        ))}
      {error && errorMessage && (
        <Label
          data-testid={'file-input-error'}
          className={errorMessageStyles}
          htmlFor={''}
        >
          {errorMessage}
        </Label>
      )}
    </div>
  );
}

export default FileInput;
