// SPDX-License-Identifier: MIT
// Copyright (c) 2024 The Pybricks Authors
// Copyright (c) 2024 The Pybricks Authors

import { call, put, race, take, takeEvery } from 'typed-redux-saga/macro';
import {
    fileStorageDidFailToReadFile,
    fileStorageDidReadFile,
    fileStorageReadFile,
} from '../fileStorage/actions';
import { pythonFileMimeType } from '../pybricksMicropython/lib';
import { defined, ensureError } from '../utils';
import {
    googleDriveDidDownloadFile,
    googleDriveDidListFolderFiles,
    googleDriveDidSelectDownloadFiles,
    googleDriveDidUploadFile,
    googleDriveDownloadFile,
    googleDriveFailToDownloadFile,
    googleDriveFailToListFolderFiles,
    googleDriveFailToUploadFile,
    googleDriveListFolderFiles,
    googleDriveUploadFile,
} from './actions';
import { DriveApiFile, DriveDocument, ListFileResponse } from './protocol';
import { getStoredOauthToken } from './utils';

function* handleDownloadFile(
    action: ReturnType<typeof googleDriveDownloadFile>,
): Generator {
    try {
        console.log('handleDownloadFile');
        const url =
            'https://www.googleapis.com/drive/v3/files/' +
            action.file.id +
            '?alt=media';
        const fetchFileContent = fetch(url, {
            headers: {
                Authorization: 'Bearer ' + getStoredOauthToken(),
            },
        }).then((response) => {
            if (response.ok) {
                return response.text();
            }
            throw new Error(`Fetch error: ${response.status}`);
        });
        const fileContent = yield* call(() => fetchFileContent);
        yield* put(googleDriveDidDownloadFile(action.file, fileContent));
    } catch (err) {
        yield* put(googleDriveFailToDownloadFile(action.file));
    }
}

function makeCreateFilePayload(fileName: string, folderId: string, content: string) {
    const form = new FormData();
    form.append(
        'metadata',
        new Blob(
            [
                JSON.stringify({
                    name: fileName,
                    mimeType: pythonFileMimeType,
                    parents: [folderId],
                }),
            ],
            { type: 'application/json' },
        ),
    );
    form.append(
        'file',
        new Blob([content], {
            type: pythonFileMimeType,
        }),
    );
    return form;
}

function* handleUploadFile(
    action: ReturnType<typeof googleDriveUploadFile>,
): Generator {
    try {
        yield* put(fileStorageReadFile(action.fileName));
        console.log(action);

        const { didRead, didFailToRead } = yield* race({
            didRead: take(
                fileStorageDidReadFile.when((a) => a.path === action.fileName),
            ),
            didFailToRead: take(
                fileStorageDidFailToReadFile.when((a) => a.path === action.fileName),
            ),
        });

        if (didFailToRead) {
            throw didFailToRead.error;
        }

        defined(didRead);

        // Check if file with same file name exists in the folder.
        const url =
            'https://www.googleapis.com/drive/v3/files?q=' +
            `trashed=false and '${action.targetFolderId}' in parents and name='${action.fileName}'`;
        const fetchFolderFiles = fetch(url, {
            headers: {
                Authorization: 'Bearer ' + getStoredOauthToken(),
            },
        })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error(`Fetch error: ${response.status}`);
            })
            .then((listFileResponse: ListFileResponse) => {
                return listFileResponse.files;
            });
        const files = yield* call(() => fetchFolderFiles);
        const existingFile = files.find((item) => item.name === action.fileName);
        console.log('existing file: ', existingFile);

        const uploadFile = (
            existingFile
                ? fetch(
                      `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`,
                      {
                          method: 'PATCH',
                          headers: new Headers({
                              Authorization: 'Bearer ' + getStoredOauthToken(),
                              'Content-type': pythonFileMimeType,
                          }),
                          body: didRead.contents,
                      },
                  )
                : fetch(
                      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
                      {
                          method: 'POST',
                          headers: new Headers({
                              Authorization: 'Bearer ' + getStoredOauthToken(),
                          }),
                          body: makeCreateFilePayload(
                              action.fileName,
                              action.targetFolderId,
                              didRead.contents,
                          ),
                      },
                  )
        )
            .then((response) => response.json())
            .then((jsonResponse) => {
                console.log('Google drive file id:', jsonResponse.id);
                return jsonResponse.id;
            });

        const fileId = yield* call(() => uploadFile);

        yield* put(googleDriveDidUploadFile(fileId, existingFile !== undefined));
    } catch (err) {
        console.log('Failed to upload file to Google Drive:', err);
        yield* put(googleDriveFailToUploadFile(ensureError(err)));
    }
}

function* handleListFolderFiles(
    action: ReturnType<typeof googleDriveListFolderFiles>,
): Generator {
    try {
        // List all files in the folder (non-recursively, only direct children)
        // Exclude folders by filtering for files only
        const url =
            'https://www.googleapis.com/drive/v3/files?q=' +
            encodeURIComponent(
                `trashed=false and '${action.folderId}' in parents and mimeType!='application/vnd.google-apps.folder'`,
            ) +
            '&fields=files(id,name,mimeType,sizeBytes,modifiedTime)';
        const fetchFolderFiles = fetch(url, {
            headers: {
                Authorization: 'Bearer ' + getStoredOauthToken(),
            },
        })
            .then((response) => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error(`Fetch error: ${response.status}`);
            })
            .then((listFileResponse: { files: DriveApiFile[] }) => {
                // Filter to only include Python files: .py extension or correct MIME type
                return listFileResponse.files.filter(
                    (file) =>
                        file.name.endsWith('.py') ||
                        file.mimeType === pythonFileMimeType ||
                        file.mimeType === '', // Include files where MIME type couldn't be determined
                );
            });

        const pythonFiles = yield* call(() => fetchFolderFiles);

        if (pythonFiles.length === 0) {
            console.log('No Python files found in the selected folder.');
            yield* put(googleDriveDidListFolderFiles([]));
            return;
        }

        // Convert to DriveDocument format expected by the rest of the system
        // The Google Drive API returns a different format, so we need to map it
        const driveDocuments: DriveDocument[] = pythonFiles.map(
            (file: DriveApiFile) => ({
                description: '',
                driveSuccess: true,
                embedUrl: '',
                iconUrl: '',
                id: file.id,
                isShared: false,
                lastEditedUtc: file.modifiedTime
                    ? new Date(file.modifiedTime).getTime()
                    : Date.now(),
                mimeType: file.mimeType || pythonFileMimeType,
                name: file.name,
                rotation: 0,
                rotationDegree: 0,
                serviceId: 'drive',
                sizeBytes: parseInt(file.sizeBytes || '0', 10),
                type: 'document',
                url: '',
            }),
        );

        yield* put(googleDriveDidListFolderFiles(driveDocuments));
        // Automatically trigger the download flow for all Python files found
        yield* put(googleDriveDidSelectDownloadFiles(driveDocuments));
    } catch (err) {
        console.log('Failed to list folder files:', err);
        yield* put(googleDriveFailToListFolderFiles(ensureError(err)));
    }
}

export default function* (): Generator {
    yield* takeEvery(googleDriveDownloadFile, handleDownloadFile);
    yield* takeEvery(googleDriveUploadFile, handleUploadFile);
    yield* takeEvery(googleDriveListFolderFiles, handleListFolderFiles);
}
