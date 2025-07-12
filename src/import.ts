import {
  FAILED,
  FILE_SELECT_ERROR,
  FILE_SELECTED,
  FINISHED,
} from '../compass/packages/compass-import-export/src/modules/import';
import { CSVParsableFieldType } from '../compass/packages/compass-import-export/src/csv/csv-types';
import type { ImportThunkAction } from '../compass/packages/compass-import-export/src/stores/import-store';
import FILE_TYPES from '../compass/packages/compass-import-export/src/constants/file-types';
import { onStarted, cancelImport } from '../compass/packages/compass-import-export/src/modules/import'
import {
  showBloatedDocumentSignalToast,
  showUnboundArraySignalToast,
  showCancelledToast,
  showCompletedToast,
  showCompletedWithErrorsToast,
  showFailedToast,
  showInProgressToast,
  showStartingToast,
} from '../compass/packages/compass-import-export/src/components/import-toast';
import { showErrorDetails } from '../compass/packages/compass-components/src/hooks/use-error-details'
import { ErrorJSON, ImportResult } from '../compass/packages/compass-import-export/src/import/import-types';


const onFileSelectError = (error: Error) => ({
  type: FILE_SELECT_ERROR,
  error,
});


const onFailed = (error: Error) => ({ type: FAILED, error });

const onFinished = ({
  aborted,
  firstErrors,
}: {
  aborted: boolean;
  firstErrors: Error[];
}) => ({
  type: FINISHED,
  aborted,
  firstErrors,
});

export const selectImportFile = (
  file: File
): ImportThunkAction<Promise<void>> => {
  return async (dispatch, _getState, { logger: { log, mongoLogId } }) => {
    try {
      // const detected = await guessFileType({ input });
      // guess file type
      const formData = new FormData()
      formData.append("file", file);

      const resp = await fetch("/guess-filetype", {
        method: "POST",
        body: formData
      })
      const detected = await resp.json()
      if (detected.type === 'unknown') {
        throw new Error('Cannot determine the file type');
      }

      // This is temporary. The store should just work with one fileType var
      const fileIsMultilineJSON = detected.type === 'jsonl';
      const fileType = detected.type === 'jsonl' ? 'json' : detected.type;

      dispatch({
        type: FILE_SELECTED,
        delimiter: detected.type === 'csv' ? detected.csvDelimiter : undefined,
        newline: detected.type === 'csv' ? detected.newline : undefined,
        fileName: file.name,
        fileStats: {},
        fileIsMultilineJSON,
        fileType
      });

      // We only ever display preview rows for CSV files underneath the field
      // type selects
      if (detected.type === 'csv') {
        throw new Error('CSV not supported');
        //await dispatch(loadCSVPreviewDocs());
      }
    } catch (err: any) {
      log.info(
        mongoLogId(1_001_000_189),
        'Import',
        'Import select file error',
        {
          fileName: file.name,
          error: err?.message,
        }
      );

      if (
        err?.message?.includes(
          'The encoded data was not valid for encoding utf-8'
        )
      ) {
        err.message = `Unable to load the file. Make sure the file is valid CSV or JSON. Error: ${err?.message as string
          }`;
      }

      dispatch(onFileSelectError(new Error(err)));
    }
  };
};


export const startImport = (file: File): ImportThunkAction<Promise<void>> => {
  return async (
    dispatch,
    getState,
    {
      connections,
      globalAppRegistry: appRegistry,
      workspaces,
      track,
      logger: { log, mongoLogId, debug },
    }
  ) => {
    const startTime = Date.now();

    const {
      import: {
        fileName,
        fileType,
        fileIsMultilineJSON,
        fileStats,
        delimiter,
        newline,
        ignoreBlanks: ignoreBlanks_,
        stopOnErrors,
        exclude,
        transform,
        namespace: ns,
        connectionId,
      },
    } = getState();

    const ignoreBlanks = ignoreBlanks_ && fileType === FILE_TYPES.CSV;
    const fileSize = fileStats?.size || 0;
    const fields: Record<string, CSVParsableFieldType> = {};
    for (const [name, type] of transform) {
      if (exclude.includes(name)) {
        continue;
      }
      fields[name] = type;
    }


    const firstErrors: ErrorJSON[] = [];

    let errorLogFilePath: string | undefined = undefined;

    log.info(
      mongoLogId(1001000080),
      'Import',
      'Start reading from source file',
      {
        ns,
        fileName,
        fileType,
        fileIsMultilineJSON,
        fileSize,
        delimiter,
        ignoreBlanks,
        stopOnErrors,
        exclude,
        transform,
      }
    );

    const abortController = new AbortController();
    const abortSignal = abortController.signal;
    dispatch(
      onStarted({
        abortController,
        errorLogFilePath: '',
      })
    );

    showStartingToast({
      cancelImport: () => dispatch(cancelImport()),
      fileName,
    });

    let result: ImportResult;
    try {
      if (!connectionId) {
        throw new Error('ConnectionId not provided');
      }

      const formData = new FormData();
      formData.append('file', file);

      if (fileType === 'csv') {
        formData.append('json', JSON.stringify({
          ns,
          delimiter,
          newline,
          fields,
          stopOnErrors,
          ignoreEmptyStrings: ignoreBlanks,
          connectionId
        }))

        const resp = await fetch('/upload-csv', {
          method: 'POST',
          body: formData
        });

        result = await resp.json()

      } else {
        formData.append('json', JSON.stringify({
          ns,
          stopOnErrors,
          jsonVariant: fileIsMultilineJSON ? 'jsonl' : 'json',
          connectionId
        }))
        const resp = await fetch('/upload-json', {
          method: 'POST',
          body: formData
        });

        result = await resp.json()
      }

    } catch (err: any) {
      track(
        'Import Completed',
        {
          duration: Date.now() - startTime,
          delimiter: fileType === 'csv' ? delimiter ?? ',' : undefined,
          newline: fileType === 'csv' ? newline : undefined,
          file_type: fileType,
          all_fields: exclude.length === 0,
          stop_on_error_selected: stopOnErrors,
          number_of_docs: err.result?.docsWritten,
          success: !err,
          aborted: abortSignal.aborted,
          ignore_empty_strings: fileType === 'csv' ? ignoreBlanks : undefined,
        },
        connections.getConnectionById(connectionId)?.info
      );

      log.error(mongoLogId(1001000081), 'Import', 'Import failed', {
        ns,
        //errorLogFilePath,
        docsWritten: err.result?.docsWritten,
        error: err.message,
      });
      debug('Error while importing:', err.stack);

      const errInfo =
        err?.writeErrors?.length && err?.writeErrors[0]?.err?.errInfo;
      showFailedToast(
        err as Error,
        errInfo &&
        (() =>
          showErrorDetails({
            details: errInfo,
            closeAction: 'close',
          }))
      );

      dispatch(onFailed(err as Error));
      return;
    }

    track(
      'Import Completed',
      {
        duration: Date.now() - startTime,
        delimiter: fileType === 'csv' ? delimiter ?? ',' : undefined,
        newline: fileType === 'csv' ? newline : undefined,
        file_type: fileType,
        all_fields: exclude.length === 0,
        stop_on_error_selected: stopOnErrors,
        number_of_docs: result.docsWritten,
        success: true,
        aborted: result.aborted,
        ignore_empty_strings: fileType === 'csv' ? ignoreBlanks : undefined,
      },
      connections.getConnectionById(connectionId)?.info
    );

    log.info(mongoLogId(1001000082), 'Import', 'Import completed', {
      ns,
      docsWritten: result.docsWritten,
      docsProcessed: result.docsProcessed,
    });



    if (result.aborted) {
      showCancelledToast({
        errors: firstErrors,
      });
    } else {
      const onReviewDocumentsClick = appRegistry
        ? () => {
          workspaces.openCollectionWorkspace(connectionId, ns, {
            newTab: true,
          });
        }
        : undefined;

      if (result.biggestDocSize > 10_000_000) {
        showBloatedDocumentSignalToast({ onReviewDocumentsClick });
      }

      if (result.hasUnboundArray) {
        showUnboundArraySignalToast({ onReviewDocumentsClick });
      }

      if (firstErrors.length > 0) {
        showCompletedWithErrorsToast({
          docsWritten: result.docsWritten,
          errors: firstErrors,
          docsProcessed: result.docsProcessed,
        });
      } else {
        showCompletedToast({
          docsWritten: result.docsWritten,
        });
      }
    }

    dispatch(
      onFinished({
        aborted: !!result.aborted,
        firstErrors,
      })
    );

    const payload = {
      ns,
      size: fileSize,
      fileType,
      docsWritten: result.docsWritten,
      fileIsMultilineJSON,
      delimiter,
      ignoreBlanks,
      stopOnErrors,
      hasExcluded: exclude.length > 0,
      hasTransformed: transform.length > 0,
    };


    appRegistry.emit('import-finished', payload, {
      connectionId,
    });

  };
};