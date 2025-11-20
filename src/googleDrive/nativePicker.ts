// SPDX-License-Identifier: MIT
// Copyright (c) 2024 The Pybricks Authors

import { googleApiKey } from '../app/constants';
import { PickerResponse } from './protocol';
import { getStoredDefaultFolderId, getStoredOauthToken } from './utils';

// Type definitions for Google Picker API
declare global {
    interface Window {
        gapi?: {
            load: (
                api: string,
                options:
                    | {
                          callback?: () => void;
                          onerror?: () => void;
                      }
                    | (() => void),
            ) => void;
        };
        google?: {
            picker?: {
                PickerBuilder: new () => PickerBuilder;
                ViewId: {
                    DOCS: string;
                    RECENTLY_PICKED: string;
                };
                DocsView: new (viewId: string) => DocsView;
            };
        };
    }
}

interface PickerBuilder {
    addView: (view: DocsView) => PickerBuilder;
    setOAuthToken: (token: string) => PickerBuilder;
    setDeveloperKey: (key: string) => PickerBuilder;
    setCallback: (callback: (data: PickerResponse) => void) => PickerBuilder;
    setOrigin: (origin: string) => PickerBuilder;
    setMultiSelect: (enabled: boolean) => PickerBuilder;
    setSize: (width: number, height: number) => PickerBuilder;
    build: () => Picker;
}

interface DocsView {
    setIncludeFolders: (include: boolean) => DocsView;
    setSelectFolderEnabled: (enabled: boolean) => DocsView;
    setMimeTypes: (mimeTypes: string) => DocsView;
    setParent: (parentId: string) => DocsView;
    setOwnedByMe: (owned: boolean) => DocsView;
}

interface Picker {
    setVisible: (visible: boolean) => void;
}

/**
 * Loads the Google Picker API script if not already loaded.
 */
function loadGooglePickerAPI(): Promise<void> {
    return new Promise((resolve, reject) => {
        // Check if already loaded
        if (window.google?.picker) {
            resolve();
            return;
        }

        // Check if script is already being loaded
        const existingScript = document.querySelector('script[src*="picker"]');
        if (existingScript) {
            // Wait for it to load (max 10 seconds)
            let attempts = 0;
            const maxAttempts = 100;
            const checkInterval = setInterval(() => {
                attempts++;
                if (window.google?.picker) {
                    clearInterval(checkInterval);
                    resolve();
                } else if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    reject(new Error('Timeout waiting for Google Picker API'));
                }
            }, 100);
            return;
        }

        // Load the Google API script first
        const apiScript = document.createElement('script');
        apiScript.src = 'https://apis.google.com/js/api.js';
        apiScript.onload = () => {
            if (!window.gapi) {
                reject(new Error('Failed to load Google API'));
                return;
            }
            // Load the picker module
            window.gapi.load('picker', {
                callback: () => {
                    resolve();
                },
                onerror: () => {
                    reject(new Error('Failed to load Google Picker module'));
                },
            });
        };
        apiScript.onerror = () => {
            reject(new Error('Failed to load Google API script'));
        };
        document.head.appendChild(apiScript);
    });
}

/**
 * Opens the native Google Picker with multiple views (My Drive, Recent, Shared with me).
 */
export function openNativeGooglePicker(callback: (data: PickerResponse) => void): void {
    loadGooglePickerAPI()
        .then(() => {
            const token = getStoredOauthToken();
            const defaultFolderId = getStoredDefaultFolderId();

            if (!window.google?.picker) {
                throw new Error('Google Picker API not available');
            }

            const pickerApi = window.google.picker;
            if (!pickerApi) {
                throw new Error('Google Picker API not available');
            }

            const { PickerBuilder, ViewId, DocsView } = pickerApi;

            // Create My Drive view
            const myDriveView = new DocsView(ViewId.DOCS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true);
            if (defaultFolderId) {
                myDriveView.setParent(defaultFolderId);
            }

            // Create Recent view
            const recentView = new DocsView(ViewId.RECENTLY_PICKED)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true);

            // Create Shared with me view (files not owned by me)
            const sharedView = new DocsView(ViewId.DOCS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true)
                .setOwnedByMe(false);

            // Build the picker
            const picker = new PickerBuilder()
                .addView(myDriveView)
                .addView(recentView)
                .addView(sharedView)
                .setOAuthToken(token)
                .setDeveloperKey(googleApiKey)
                .setCallback(callback)
                .setOrigin(window.location.origin)
                .setMultiSelect(true)
                .setSize(1200, 635)
                .build();

            picker.setVisible(true);
        })
        .catch((err) => {
            console.error('Failed to open Google Picker:', err);
            // Fallback: could show an error message to the user
        });
}
