// SPDX-License-Identifier: MIT
// Copyright (c) 2024 The Pybricks Authors

import GoogleDrivePicker from 'google-drive-picker';
import type { PickerConfiguration } from 'google-drive-picker/dist/typeDefs';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { googleApiKey, googleClientId } from '../app/constants';
import { pythonFileMimeType } from '../pybricksMicropython/lib';
import {
    googleDriveDidSelectDownloadFiles,
    googleDriveDidSelectFolder,
    googleDriveListFolderFiles,
} from './actions';
import { DriveDocument, PickerResponse } from './protocol';
import {
    getStoredDefaultFolderId,
    getStoredOauthToken,
    saveDefaultFolderId,
    saveOauthToken,
} from './utils';

export default function DownloadPicker() {
    const [pickedDocs, setPickedDocs] = useState<DriveDocument[]>([]);
    const [openPicker, authResponse] = GoogleDrivePicker();
    const dispatch = useDispatch();

    const openDownloadPicker = () => {
        // TODO: remove after debugging.
        console.log(
            'stored_token: ',
            sessionStorage.getItem('google_oauth_token_expiration'),
            ', ',
            sessionStorage.getItem('google_oauth_token'),
        );
        const authToken = getStoredOauthToken();
        const defaultFolderId = getStoredDefaultFolderId();
        const pickerConfig: PickerConfiguration = {
            clientId: googleClientId,
            developerKey: googleApiKey,
            viewId: 'DOCS',
            // Remove viewMimeTypes restriction to show all files, filter on client side
            token: authToken,
            customScopes: ['https://www.googleapis.com/auth/drive'],
            setIncludeFolders: true,
            setSelectFolderEnabled: true, // Enable folder selection
            multiselect: true,
            supportDrives: true,
            callbackFunction: (data: PickerResponse) => {
                console.log(data);
                if (data.action === 'picked' && data.docs) {
                    // Separate folders from files
                    const folders = data.docs.filter(
                        (doc) => doc.mimeType === 'application/vnd.google-apps.folder',
                    );
                    const files = data.docs.filter(
                        (doc) =>
                            doc.mimeType !== 'application/vnd.google-apps.folder' &&
                            (doc.name.endsWith('.py') || // Include .py files
                                doc.mimeType === pythonFileMimeType || // Include files with correct MIME type
                                doc.mimeType === ''), // Include files where MIME type couldn't be determined
                    );

                    // Handle folder selection: automatically list Python files in the folder
                    if (folders.length > 0) {
                        const selectedFolder = folders[0]; // Use first folder if multiple selected
                        saveDefaultFolderId(selectedFolder.id);
                        if (authToken) {
                            // List all Python files in the selected folder (non-recursively)
                            dispatch(googleDriveListFolderFiles(selectedFolder.id));
                        } else {
                            // Store folder for later when auth token is available
                            setPickedDocs([selectedFolder]);
                        }
                    }

                    // Handle direct file selection: process files as before
                    if (files.length > 0) {
                        if (authToken) {
                            dispatch(googleDriveDidSelectDownloadFiles(files));
                        } else {
                            setPickedDocs(files);
                        }
                    }

                    // If only folders were selected and no files, the folder handler above will take care of it
                    if (folders.length === 0 && files.length === 0) {
                        console.log('No Python files or folders selected.');
                    }
                } else {
                    console.log('dialog cancelled, nothing happens.');
                }
            },
        };

        // Set default folder if one is stored
        if (defaultFolderId) {
            pickerConfig.setParentFolder = defaultFolderId;
        }

        openPicker(pickerConfig);
    };

    // When auth token is not available, need to wait for the auth token to be available until dispatching actions
    useEffect(() => {
        if (authResponse) {
            saveOauthToken(authResponse.access_token, authResponse.expires_in);
            if (pickedDocs && pickedDocs.length > 0) {
                // Check if it's a folder or files
                const folder = pickedDocs.find(
                    (doc) => doc.mimeType === 'application/vnd.google-apps.folder',
                );
                if (folder) {
                    // It's a folder, list Python files in it
                    dispatch(googleDriveListFolderFiles(folder.id));
                } else {
                    // It's files, process them directly
                    dispatch(googleDriveDidSelectDownloadFiles(pickedDocs));
                }
            }
        }
    }, [authResponse, pickedDocs, dispatch]);
    return openDownloadPicker;
}

export function FolderPicker() {
    const [openPicker, authResponse] = GoogleDrivePicker();
    const dispatch = useDispatch();

    const openFolderPicker = () => {
        const defaultFolderId = getStoredDefaultFolderId();
        const pickerConfig: PickerConfiguration = {
            clientId: googleClientId,
            developerKey: googleApiKey,
            viewId: 'FOLDERS',
            token: getStoredOauthToken(),
            customScopes: ['https://www.googleapis.com/auth/drive'],
            setSelectFolderEnabled: true,
            supportDrives: true,
            callbackFunction: (data: PickerResponse) => {
                if (data.action === 'picked' && data.docs) {
                    const selectedFolder = data.docs[0];
                    // Save the selected folder as the default for next time
                    saveDefaultFolderId(selectedFolder.id);
                    dispatch(googleDriveDidSelectFolder(selectedFolder));
                }
            },
        };

        // Set default folder if one is stored
        if (defaultFolderId) {
            pickerConfig.setParentFolder = defaultFolderId;
        }

        openPicker(pickerConfig);
    };

    useEffect(() => {
        if (authResponse) {
            saveOauthToken(authResponse.access_token, authResponse.expires_in);
        }
    }, [authResponse]);

    return openFolderPicker;
}
