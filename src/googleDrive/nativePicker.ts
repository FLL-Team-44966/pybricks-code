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
                Feature: {
                    MULTISELECT_ENABLED: string;
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
    enableFeature: (feature: string) => PickerBuilder;
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
        const existingScript = document.querySelector('script[src*="picker.js"]');
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

        // Load the picker API directly via script tag
        // The picker API needs to be loaded separately from the main API
        const pickerScript = document.createElement('script');
        pickerScript.src = 'https://apis.google.com/js/picker.js';
        pickerScript.onload = () => {
            // Wait a bit for the API to initialize
            setTimeout(() => {
                if (window.google?.picker) {
                    resolve();
                } else {
                    reject(new Error('Google Picker API loaded but not available'));
                }
            }, 100);
        };
        pickerScript.onerror = () => {
            reject(new Error('Failed to load Google Picker API script'));
        };
        document.head.appendChild(pickerScript);
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

            const { PickerBuilder, ViewId, Feature, DocsView } = pickerApi;

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
                .enableFeature(Feature.MULTISELECT_ENABLED)
                .setSize(1200, 635)
                .build();

            picker.setVisible(true);
        })
        .catch((err) => {
            console.error('Failed to open Google Picker:', err);
            // Fallback: could show an error message to the user
        });
}

/**
 * Opens the native Google Picker for folder selection only.
 */
export function openNativeFolderPicker(
    callback: (data: PickerResponse) => void,
    defaultFolderId?: string,
): void {
    loadGooglePickerAPI()
        .then(() => {
            const token = getStoredOauthToken();

            if (!window.google?.picker) {
                throw new Error('Google Picker API not available');
            }

            const pickerApi = window.google.picker;
            if (!pickerApi) {
                throw new Error('Google Picker API not available');
            }

            const { PickerBuilder, ViewId, DocsView } = pickerApi;

            // Create folder-only view
            const folderView = new DocsView(ViewId.DOCS)
                .setIncludeFolders(true)
                .setSelectFolderEnabled(true);
            if (defaultFolderId) {
                folderView.setParent(defaultFolderId);
            }

            // Build the picker
            const picker = new PickerBuilder()
                .addView(folderView)
                .setOAuthToken(token)
                .setDeveloperKey(googleApiKey)
                .setCallback(callback)
                .setOrigin(window.location.origin)
                .setSize(1200, 635)
                .build();

            picker.setVisible(true);
        })
        .catch((err) => {
            console.error('Failed to open Google Folder Picker:', err);
            // Fallback: could show an error message to the user
        });
}
