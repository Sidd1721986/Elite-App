import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { appleAuth } from '@invertase/react-native-apple-authentication';
import { SecureStorage } from './secureStorage';
import { apiClient, setApiClientAuthToken } from './apiClient';
import { User, UserRole } from '../types/types';
import { toApiRole } from './authService';
import { GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '../config/appConfig';

export type SocialProvider = 'apple' | 'google';

export interface SocialLoginResult {
    ok: boolean;
    user?: User;
    pendingApproval?: boolean;
    cancelled?: boolean;
    message?: string;
}

let googleConfigured = false;

function ensureGoogleConfigured(): boolean {
    if (!GOOGLE_WEB_CLIENT_ID) { return false; }
    if (!googleConfigured) {
        GoogleSignin.configure({
            webClientId: GOOGLE_WEB_CLIENT_ID,
            ...(Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
        });
        googleConfigured = true;
    }
    return true;
}

export function isGoogleAvailable(): boolean {
    return Boolean(GOOGLE_WEB_CLIENT_ID);
}

export function isAppleAvailable(): boolean {
    return Platform.OS === 'ios' && appleAuth.isSupported;
}

/** Exchange a provider ID token for our own JWT session via POST /auth/social. */
async function exchangeToken(
    provider: SocialProvider,
    idToken: string,
    role: UserRole,
    name?: string | null,
): Promise<SocialLoginResult> {
    const response = await apiClient.post<{
        token?: string;
        user?: User;
        pendingApproval?: boolean;
        message?: string;
    }>('/auth/social', {
        provider,
        idToken,
        role: toApiRole(role),
        name: name || undefined,
    });

    if (response.pendingApproval) {
        return { ok: false, pendingApproval: true, message: response.message || 'Your vendor account is awaiting approval.' };
    }

    if (response.token && response.user) {
        await SecureStorage.setItem('auth_token', response.token);
        setApiClientAuthToken(response.token);
        await AsyncStorage.setItem('@current_user', JSON.stringify(response.user));
        return { ok: true, user: response.user };
    }

    return { ok: false, message: response.message || 'Sign-in failed' };
}

export async function signInWithApple(role: UserRole): Promise<SocialLoginResult> {
    try {
        const response = await appleAuth.performRequest({
            requestedOperation: appleAuth.Operation.LOGIN,
            requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        });

        if (!response.identityToken) {
            return { ok: false, message: 'Apple did not return a token. Please try again.' };
        }

        // Apple only provides the name on the FIRST authorization for this Apple ID —
        // pass it along so a brand-new account isn't named after the email prefix.
        const nameParts = [response.fullName?.givenName, response.fullName?.familyName].filter(Boolean);
        const name = nameParts.length ? nameParts.join(' ') : undefined;

        return await exchangeToken('apple', response.identityToken, role, name);
    } catch (error: any) {
        if (error?.code === appleAuth.Error.CANCELED) {
            return { ok: false, cancelled: true };
        }
        if (__DEV__) { console.error('Apple sign-in error:', error); }
        return { ok: false, message: error?.message || 'Apple sign-in failed' };
    }
}

export async function signInWithGoogle(role: UserRole): Promise<SocialLoginResult> {
    if (!ensureGoogleConfigured()) {
        return { ok: false, message: 'Google sign-in is not configured.' };
    }
    try {
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const result = await GoogleSignin.signIn();

        // v13+: cancelled sign-in resolves with type 'cancelled' instead of throwing.
        if ((result as any)?.type === 'cancelled') {
            return { ok: false, cancelled: true };
        }

        const data = (result as any)?.data ?? result;
        const idToken: string | undefined = data?.idToken;
        if (!idToken) {
            return { ok: false, message: 'Google did not return a token. Please try again.' };
        }

        const name: string | undefined = data?.user?.name || undefined;
        return await exchangeToken('google', idToken, role, name);
    } catch (error: any) {
        if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
            return { ok: false, cancelled: true };
        }
        if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
            return { ok: false, message: 'Google Play Services is required for Google sign-in.' };
        }
        if (__DEV__) { console.error('Google sign-in error:', error); }
        return { ok: false, message: error?.message || 'Google sign-in failed' };
    }
}
