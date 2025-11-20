// SPDX-License-Identifier: MIT
// Copyright (c) 2024 The Pybricks Authors

const googleOauthTokenExpirationStorageKey = 'google_oauth_token_expiration';
const googleOauthTokenStorageKey = 'google_oauth_token';
const googleDriveDefaultFolderIdStorageKey = 'google_drive_default_folder_id';

export function getStoredOauthToken(): string {
    const tokenExpiration = sessionStorage.getItem(
        googleOauthTokenExpirationStorageKey,
    );
    if (!tokenExpiration || Date.now() > parseInt(tokenExpiration)) {
        return '';
    }

    return sessionStorage.getItem(googleOauthTokenStorageKey) || '';
}
export function saveOauthToken(authToken: string, expireIn: number) {
    console.log('auth token updated');
    sessionStorage.setItem(googleOauthTokenStorageKey, authToken);
    sessionStorage.setItem(
        googleOauthTokenExpirationStorageKey,
        (1000 * expireIn + Date.now()).toString(),
    );
}

export function getStoredDefaultFolderId(): string {
    return localStorage.getItem(googleDriveDefaultFolderIdStorageKey) || '';
}

export function saveDefaultFolderId(folderId: string) {
    localStorage.setItem(googleDriveDefaultFolderIdStorageKey, folderId);
}
