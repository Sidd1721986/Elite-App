# 🛠️ Local Development Guide: Elite Home Services USA

Follow these steps to run your entire application locally on your machine.

---

## 🏗️ Part 1: Running the Backend

The easiest way to run the backend is using **Docker**, as it handles the database and API environment for you automatically.

### Option A: Using Docker (Recommended)
This spins up both the **Postgres Database** and the **.NET API**.

1. **Open your terminal** to the project root: `/Users/siddharthsengar/Desktop/multi-user-auth-app`
2. **Run the services**:
   ```bash
   docker-compose up -d --build
   ```
3. **Verify it's running**:
   - Database is on port `5432`.
   - API is on port `5260`.
   - Check the health: [http://localhost:5260/health](http://localhost:5260/health)

### Option B: Running Manually (Native)
Use this if you want to see live console logs or debug the C# code directly.

1. **Ensure Postgres is running** (either via Docker or a local install).
2. **Navigate to the backend folder**:
   ```bash
   cd backend
   ```
3. **Run the API**:
   ```bash
   dotnet run
   ```

---

## 📱 Part 2: Running the Mobile App

Ensure your backend is running first so the app can talk to it!

1. **Open a new terminal window** to the project root: `/Users/siddharthsengar/Desktop/multi-user-auth-app`
2. **Install dependencies** (the first time only):
   ```bash
   npm install
   ```
3. **Start the Metro Bundler**:
   ```bash
   npm start
   ```
4. **Launch the App**:
   - **For iOS**: Press `i` in the terminal (or run `npm run ios`).
   - **For Android**: Press `a` in the terminal (or run `npm run android`).

---

## 💡 Pro Tips

- **Database GUI**: You can connect to your local database using **DBeaver** or **pgAdmin** at `localhost:5432` (User: `postgres`, Pass: `postgres`).
- **Resetting Everything**: If things get messy with Docker, run:
  ```bash
  docker-compose down -v && docker-compose up -d --build
  ```
- **Mobile API Connection**: In development, your mobile app is configured to talk to your local IP or `10.0.2.2` (Android) automatically. Ensure your phone and computer are on the same Wi-Fi.
