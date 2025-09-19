// SPDX-License-Identifier: MIT
// Copyright (c) 2024 The Pybricks Authors

import GoogleDrivePicker from 'google-drive-picker';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { googleApiKey, googleClientId } from '../app/constants';
import { pythonFileMimeType } from '../pybricksMicropython/lib';
import {
    googleDriveDidSelectDownloadFiles,
    googleDriveDidSelectFolder,
} from './actions';
import { DriveDocument, PickerResponse } from './protocol';
import { getStoredOauthToken, saveOauthToken } from './utils';

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
        openPicker({
            clientId: googleClientId,
            developerKey: googleApiKey,
            viewId: 'DOCS',
            // Remove viewMimeTypes restriction to show all files, filter on client side
            token: authToken,
            customScopes: ['https://www.googleapis.com/auth/drive'],
            setIncludeFolders: true,
            setSelectFolderEnabled: false,
            multiselect: true,
            supportDrives: true,
            callbackFunction: (data: PickerResponse) => {
                console.log(data);
                if (data.action === 'picked' && data.docs) {
                    // Filter to only include Python files and folders
                    const filteredDocs = data.docs.filter(
                        (doc) =>
                            doc.mimeType === 'application/vnd.google-apps.folder' || // Include folders
                            doc.name.endsWith('.py') || // Include .py files
                            doc.mimeType === pythonFileMimeType || // Include files with correct MIME type
                            doc.mimeType === '', // Include files where MIME type couldn't be determined
                    );

                    if (filteredDocs.length > 0) {
                        if (authToken) {
                            dispatch(googleDriveDidSelectDownloadFiles(filteredDocs));
                        } else {
                            setPickedDocs(filteredDocs);
                        }
                    } else {
                        console.log('No Python files or folders selected.');
                    }
                } else {
                    console.log('dialog cancelled, nothing happens.');
                }
            },
        });
    };

    // When auth token is not available, need to wait for the auth token to be available until dispatching DidSelectDownloadFiles
    useEffect(() => {
        if (authResponse) {
            saveOauthToken(authResponse.access_token, authResponse.expires_in);
            if (pickedDocs) {
                dispatch(googleDriveDidSelectDownloadFiles(pickedDocs));
            }
        }
    }, [authResponse, pickedDocs, dispatch]);
    return openDownloadPicker;
}

export function FolderPicker() {
    const [openPicker, authResponse] = GoogleDrivePicker();
    const dispatch = useDispatch();

    const openFolderPicker = () => {
        openPicker({
            clientId: googleClientId,
            developerKey: googleApiKey,
            viewId: 'FOLDERS',
            token: getStoredOauthToken(),
            customScopes: ['https://www.googleapis.com/auth/drive'],
            setSelectFolderEnabled: true,
            supportDrives: true,
            callbackFunction: (data: PickerResponse) => {
                if (data.action === 'picked' && data.docs) {
                    dispatch(googleDriveDidSelectFolder(data.docs[0]));
                }
            },
        });
    };

    useEffect(() => {
        if (authResponse) {
            saveOauthToken(authResponse.access_token, authResponse.expires_in);
        }
    }, [authResponse]);

    return openFolderPicker;
}
