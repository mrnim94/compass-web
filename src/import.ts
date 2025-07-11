import {
  FILE_SELECT_ERROR,
  FILE_SELECTED,
} from '../compass/packages/compass-import-export/src/modules/import';
import type { ImportThunkAction } from '../compass/packages/compass-import-export/src/stores/import-store';

const onFileSelectError = (error: Error) => ({
  type: FILE_SELECT_ERROR,
  error,
});

export const selectImportFile = (
  file: File
): ImportThunkAction<Promise<void>> => {
  return async (dispatch, _getState, { logger: { log, mongoLogId } }) => {
    try {
      // const detected = await guessFileType({ input });
      const detected = {
        type: 'json',
      };
      // if (detected.type === 'unknown') {
      //   throw new Error('Cannot determine the file type');
      // }

      // // This is temporary. The store should just work with one fileType var
      // const fileIsMultilineJSON = detected.type === 'jsonl';
      // const fileType = detected.type === 'jsonl' ? 'json' : detected.type;

      dispatch({
        type: FILE_SELECTED,
        delimiter: undefined, //detected.type === 'csv' ? detected.csvDelimiter : undefined,
        newline: undefined, //detected.type === 'csv' ? detected.newline : undefined,
        fileName: file.name,
        fileStats: {},
        fileIsMultilineJSON: true,
        fileType: 'jsonl',
      });

      // We only ever display preview rows for CSV files underneath the field
      // type selects
      if (detected.type === 'csv') {
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
        err.message = `Unable to load the file. Make sure the file is valid CSV or JSON. Error: ${
          err?.message as string
        }`;
      }

      dispatch(onFileSelectError(new Error(err)));
    }
  };
};
