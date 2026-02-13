# Multi-User Authentication App

A React Native application built with Expo that supports three user types: **Admin**, **Vendor**, and **Customer**. The app features role-based authentication and access control, working on both iOS and Android platforms.

## Features

- ✅ **Unified Login & Signup**: Single page for all three user types
- ✅ **Role-Based Access Control**: Different permissions for each user type
- ✅ **Admin Full Access**: Admins can access all dashboards
- ✅ **Vendor Portal**: Vendors can only access vendor-specific features
- ✅ **Customer Portal**: Customers can only access customer-specific features
- ✅ **Cross-Platform**: Works on iOS and Android
- ✅ **Modern UI**: Clean, professional design with smooth animations

## User Roles

### 1. Admin
- **Access**: Full access to all sections (Admin, Vendor, and Customer dashboards)
- **Features**: User management, system settings, overview of all sections

### 2. Vendor
- **Access**: Vendor dashboard only
- **Features**: Product management, order processing, sales analytics

### 3. Customer
- **Access**: Customer dashboard only
- **Features**: Browse products, manage orders, wishlist, profile management

## Tech Stack

- **Framework**: React Native + Expo
- **Language**: TypeScript
- **Navigation**: React Navigation (Stack Navigator)
- **Storage**: AsyncStorage
- **State Management**: React Context API

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo Go app on your mobile device (optional, for testing on physical device)

### Installation

1. Navigate to the project directory:
   ```bash
   cd multi-user-auth-app
   ```

2. Install dependencies (already done):
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npx expo start
   ```

4. Run on your preferred platform:
   - Press `i` for iOS Simulator (Mac only)
   - Press `a` for Android Emulator
   - Scan QR code with Expo Go app on your phone

## Usage

### Creating Test Accounts

1. **Open the app** and navigate to the Signup screen
2. **Create users** for each role:
   - Admin user: Select "Admin" role during signup
   - Vendor user: Select "Vendor" role during signup
   - Customer user: Select "Customer" role during signup

### Testing Login

1. **Login with different credentials** to see role-based access:
   - Admin can navigate to all dashboards
   - Vendor sees only the Vendor dashboard
   - Customer sees only the Customer dashboard

### Example Test Users

After creating these users during signup, you can test with:

| Email | Password | Role | Access |
|-------|----------|------|--------|
| admin@test.com | admin123 | Admin | All dashboards |
| vendor@test.com | vendor123 | Vendor | Vendor dashboard only |
| customer@test.com | customer123 | Customer | Customer dashboard only |

## Project Structure

```
multi-user-auth-app/
├── src/
│   ├── context/
│   │   └── AuthContext.tsx        # Authentication context
│   ├── navigation/
│   │   └── AppNavigator.tsx       # Navigation setup
│   ├── screens/
│   │   ├── LoginScreen.tsx        # Login page
│   │   ├── SignupScreen.tsx       # Signup page
│   │   ├── AdminDashboard.tsx     # Admin dashboard
│   │   ├── VendorDashboard.tsx    # Vendor dashboard
│   │   └── CustomerDashboard.tsx  # Customer dashboard
│   ├── services/
│   │   └── authService.ts         # Authentication service
│   └── types/
│       └── types.ts               # TypeScript types
├── App.tsx                         # Root component
└── package.json
```

## Key Implementation Details

### Authentication Flow

1. **User Registration**: Users sign up with username, email, password, and role selection
2. **Credential Storage**: User data is stored locally using AsyncStorage
3. **Login Validation**: Email, password, and role must match for successful login
4. **Session Management**: Current user session is maintained in AsyncStorage
5. **Logout**: Clears the current session

### Role-Based Access

- **Navigation Guards**: AppNavigator conditionally renders screens based on user role
- **Admin Privileges**: Admin users can navigate between all three dashboard types
- **Restricted Access**: Vendor and Customer users can only access their respective dashboards

### Security Notes

⚠️ **Important**: This implementation uses local AsyncStorage for demonstration purposes. For production use, you should:

- Implement backend API authentication
- Use secure token-based authentication (JWT)
- Hash passwords before storage
- Implement proper session management
- Add SSL/TLS for API communication

## Troubleshooting

### Metro Bundler Issues
If you encounter bundler issues, try:
```bash
npx expo start -c
```

### Cache Issues
Clear the cache:
```bash
rm -rf node_modules
npm install
```

## Future Enhancements

- [ ] Backend API integration
- [ ] Password encryption
- [ ] Email verification
- [ ] Forgot password functionality
- [ ] User profile editing
- [ ] Push notifications
- [ ] Biometric authentication

## License

MIT License - feel free to use this project for learning or as a template for your applications.

## Support

For questions or issues, please review the code comments or create an issue in the repository.
