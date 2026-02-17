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
                { username: 'Admin User', email: 'admin', password: '123', role: UserRole.ADMIN, name: 'Admin', address: '', phone: '', referralSource: '', isApproved: true },
                { username: 'Vendor User', email: 'vendor', password: '123', role: UserRole.VENDOR, name: 'Vendor', address: '', phone: '', referralSource: '', isApproved: true },
                { username: 'Customer User', email: 'customer', password: '123', role: UserRole.CUSTOMER, name: 'Customer', address: '', phone: '', referralSource: '', isApproved: true },
            ];

            let seededAny = false;
            for (const seed of rolesToSeed) {
                if (!users.some((u: User) => u.email === seed.email)) {
                    users.push(seed as User);
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
    async signup(
        name: string,
        email: string,
        password: string,
        role: UserRole,
        address: string,
        phone: string,
        referralSource: string,
        roleOther?: string
    ): Promise<boolean> {
        try {
            const users = await this.getUsers();

            // Check if email already exists
            const existingUser = users.find(u => u.email === email);
            if (existingUser) {
                return false;
            }

            // Add new user
            const newUser: User = {
                username: email, // Using email as username for now as it was previously used
                email,
                password,
                role,
                name,
                address,
                phone,
                referralSource,
                roleOther,
                isApproved: role === UserRole.VENDOR ? false : true
            };
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

            const isCustomerRole = (r: UserRole) => [
                UserRole.CUSTOMER,
                UserRole.REALTOR,
                UserRole.PROPERTY_MANAGER,
                UserRole.BUSINESS,
                UserRole.HOME_OWNER,
                UserRole.LANDLORD,
                UserRole.OTHER
            ].includes(r);

            // Find user with matching credentials and role grouping
            const user = users.find(u => {
                const credentialsMatch = u.email === email && u.password === password;
                if (!credentialsMatch) return false;

                // Match for Vendor (must be approved)
                if (role === UserRole.VENDOR) {
                    return u.role === UserRole.VENDOR && u.isApproved === true;
                }

                // Match for Admin
                if (role === UserRole.ADMIN) {
                    return u.role === UserRole.ADMIN;
                }

                // Group all customer sub-roles under UserRole.CUSTOMER for login purposes
                if (role === UserRole.CUSTOMER) {
                    return isCustomerRole(u.role);
                }

                return u.role === role;
            });

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

    // Get users pending vendor approval
    async getPendingVendors(): Promise<User[]> {
        const users = await this.getUsers();
        return users.filter(u => u.role === UserRole.VENDOR && !u.isApproved);
    },

    // Approve or deny a vendor
    async updateUserStatus(email: string, approved: boolean): Promise<boolean> {
        try {
            const users = await this.getUsers();
            const userIndex = users.findIndex(u => u.email === email);

            if (userIndex === -1) return false;

            if (approved) {
                users[userIndex].isApproved = true;
                if (!users[userIndex].name) users[userIndex].name = users[userIndex].username;
            } else {
                users.splice(userIndex, 1);
            }

            await this.saveUsers(users);
            return true;
        } catch (error) {
            console.error('Error updating user status:', error);
            return false;
        }
    },
};
