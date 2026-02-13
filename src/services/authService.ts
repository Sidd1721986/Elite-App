import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserRole } from '../types/types';

const USERS_KEY = '@users';

export const authService = {
    // Get all users from storage
    async getUsers(): Promise<User[]> {
        try {
            const usersJson = await AsyncStorage.getItem(USERS_KEY);
            let users = usersJson ? JSON.parse(usersJson) : [];

            // Ensure default accounts exist for testing
            const rolesToSeed = [
                { username: 'Admin User', email: 'admin', password: '123', role: UserRole.ADMIN },
                { username: 'Vendor User', email: 'vendor', password: '123', role: UserRole.VENDOR },
                { username: 'Customer User', email: 'customer', password: '123', role: UserRole.CUSTOMER },
            ];

            let seededAny = false;
            for (const seed of rolesToSeed) {
                if (!users.some((u: User) => u.email === seed.email)) {
                    users.push(seed);
                    seededAny = true;
                    console.log(`✅ Seeded account: ${seed.email} / ${seed.password} (${seed.role})`);
                }
            }

            if (seededAny) {
                await this.saveUsers(users);
            }

            return users;
        } catch (error) {
            console.error('Error getting users:', error);
            return [];
        }
    },

    // Save users to storage
    async saveUsers(users: User[]): Promise<void> {
        try {
            await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
        } catch (error) {
            console.error('Error saving users:', error);
        }
    },

    // Register a new user
    async signup(username: string, email: string, password: string, role: UserRole): Promise<boolean> {
        try {
            const users = await this.getUsers();

            // Check if email already exists
            const existingUser = users.find(u => u.email === email);
            if (existingUser) {
                return false;
            }

            // Add new user
            const newUser: User = { username, email, password, role };
            users.push(newUser);
            await this.saveUsers(users);
            return true;
        } catch (error) {
            console.error('Error signing up:', error);
            return false;
        }
    },

    // Login user
    async login(email: string, password: string, role: UserRole): Promise<User | null> {
        try {
            const users = await this.getUsers();

            // Find user with matching credentials and role
            const user = users.find(
                u => u.email === email && u.password === password && u.role === role
            );

            if (user) {
                // Save current user session
                await AsyncStorage.setItem('@current_user', JSON.stringify(user));
                return user;
            }

            return null;
        } catch (error) {
            console.error('Error logging in:', error);
            return null;
        }
    },

    // Get current logged in user
    async getCurrentUser(): Promise<User | null> {
        try {
            const userJson = await AsyncStorage.getItem('@current_user');
            return userJson ? JSON.parse(userJson) : null;
        } catch (error) {
            console.error('Error getting current user:', error);
            return null;
        }
    },

    // Logout user
    async logout(): Promise<void> {
        try {
            await AsyncStorage.removeItem('@current_user');
        } catch (error) {
            console.error('Error logging out:', error);
        }
    },
};
