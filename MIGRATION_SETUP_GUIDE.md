# ETL Workflow Migration Setup Guide

---

## Prerequisites: Account Setup

### Part A: Create GitHub Account (Optional but Recommended)

**Why GitHub?**
- Store your project code safely
- Version control and backup
- Collaborate with team members
- Deploy applications easily

#### Step A1: Go to GitHub Website

1. Open your web browser (Chrome, Firefox, Safari, Edge, etc.)
2. Go to: **https://github.com**
3. You should see the GitHub homepage with the GitHub logo in top-left corner
4. Look for "Sign up" button (usually top-right corner)

#### Step A2: Click on "Sign Up"

1. Click the **"Sign up"** button in the top-right corner
2. You will be directed to: **https://github.com/signup**
3. This page displays the GitHub signup form

#### Step A3: Enter Your Email

**On the signup form:**

1. **Email field**: Enter your email address
   - Example: `yourname@gmail.com` or `yourname@company.com`
   - Use a valid email you have access to (you'll verify it)
   - ✅ Recommended: Use a professional email

2. Click **"Continue"** button

#### Step A4: Create Password

1. **Password field**: Create a strong password
   - Minimum 15 characters OR
   - Minimum 8 characters with mix of uppercase, lowercase, numbers, symbols
   - Example of strong password: `MyP@ssw0rd!2024Secure#`
   
   **Password Requirements:**
   - ❌ Don't use: password, 123456, qwerty
   - ✅ Do use: Mix of letters, numbers, special characters
   - ❌ Don't use: Same as email or username
   - ✅ Do use: Something only you know

2. Click **"Continue"** button

#### Step A5: Enter Username

1. **Username field**: Create a GitHub username
   - Only lowercase letters, numbers, and hyphens allowed
   - Must start with a letter or number
   - No special characters allowed
   - Length: 3-39 characters
   
   **Examples:**
   - ✅ Valid: `john-doe-123`, `developer-raj`, `etl-workflow`
   - ❌ Invalid: `John-Doe` (uppercase), `@john`, `..john`

2. Click **"Continue"** button
   
   **Note:** GitHub will check if username is available
   - If unavailable, enter a different name
   - Try adding numbers or hyphens

#### Step A6: Email Verification

1. **Verify email**: GitHub sends verification email to your inbox
2. Check your email inbox (wait 1-2 minutes)
3. Open the email from **noreply@github.com** with subject: "Verify your GitHub email"
4. Click the **"Verify email address"** button or link in the email
5. You'll be redirected to GitHub confirming verification success

#### Step A7: Complete Signup

1. After email verification, GitHub may ask:
   - "Would you like email updates about new features?" (Choose: Yes/No)
   - Answer any preference questions (optional)

2. Click **"Create account"** or **"Skip"** button

3. You might see GitHub's initial setup wizard:
   - Choose: "For personal use" or "For business"
   - Select your interests (optional)
   - Click **"Continue"**

#### Step A8: GitHub Account Created! 🎉

1. You're now logged into GitHub
2. You should see your GitHub dashboard
3. Your GitHub profile is accessible at: `https://github.com/YOUR-USERNAME`

#### Step A9: Create a Personal Access Token (Optional - for Git operations)

If you'll be pushing code via command line:

1. Go to: **Settings** (top-right menu > Settings)
2. Click: **Developer settings** (left sidebar, bottom)
3. Click: **Personal access tokens** → **Tokens (classic)**
4. Click: **Generate new token** → **Generate new token (classic)**
5. Fill in:
   - **Note**: `ETL Workflow Token`
   - **Expiration**: `90 days` (recommended)
   - **Scopes**: Check `repo` (full control of private repositories)
6. Click: **Generate token**
7. ⚠️ **Important**: Copy the token immediately! You won't see it again
8. Store it securely (password manager or `.env` file)
9. Use this token when pushing code to GitHub

**GitHub Account is Ready! ✅**

---

### Part B: Create Supabase Account

**Why Supabase?**
- PostgreSQL database hosting
- Real-time capabilities
- Built-in authentication
- Row-level security (RLS)
- Storage buckets for files
- Scalable and production-ready

#### Step B1: Go to Supabase Website

1. Open your web browser
2. Go to: **https://supabase.com**
3. You should see Supabase homepage with "Start your project" or "Sign Up" button
4. In top-right corner, look for **"Sign In"** or **"Get Started"** button
5. Click **"Get Started"** (or "Sign Up")

#### Step B2: Start Signup

1. You'll be taken to: **https://app.supabase.com**
2. Click **"Create new account"** or **"Sign up"** link
3. You'll see signup options:
   - Email/Password
   - GitHub (recommended - faster)
   - Google

#### Step B3: Choose Signup Method

**Option 1: Sign up with GitHub (Recommended - Quickest)**

1. Click **"Continue with GitHub"** button
2. You'll be redirected to GitHub login
3. If already logged into GitHub: Approve access
4. If not logged in: Login with your GitHub credentials from Part A
5. GitHub will ask: "Authorize supabase?"
6. Click **"Authorize supabase"** button
7. You're now logged into Supabase using GitHub! ✅

**Option 2: Sign up with Email**

1. Click **"Sign up with email"**
2. Enter your email address
3. Create a password (strong password recommended)
4. Click **"Sign up"**
5. Check email for verification link
6. Click verification link in email
7. Continue with Supabase setup

#### Step B4: Supabase Onboarding

1. After signup, you may see "Get Started" wizard
2. Questions you might see:
   - "What do you want to build?" → Choose: `Database API`
   - "How do you plan to use Supabase?" → Choose: `Building an app`
   - "Do you need real-time features?" → Choose: `Yes` (for ETL)

#### Step B5: Verify Email

1. Check your email inbox
2. Look for email from **hello@supabase.io** or **noreply@supabase.io**
3. Subject: "Confirm your email" or "Welcome to Supabase"
4. Click **"Confirm your email"** link
5. Wait for confirmation (page should refresh)

#### Step B6: Supabase Account Created! 🎉

1. You should see Supabase dashboard
2. You should see "Create a new project" option
3. Your Supabase account is ready for creating projects

**Supabase Account is Ready! ✅**

---

## Step 1: Create New Supabase Project

### Step 1.1: Access Projects

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. If logged out, log in with your email or GitHub
3. You should see your Supabase dashboard
4. In left sidebar, click **"Projects"** or you may see a list of existing projects

### Step 1.2: Create New Project

1. Click **"New project"** button (usually top-left or center of page)
2. If you don't see this, click the **"+"** icon in the top-right
3. Dialog will open: "Create a new project"

### Step 1.3: Select Organization

1. **Organization**: If you have multiple organizations, select one
   - For first-time users, usually only "Personal" organization exists
   - Select **"Personal"** (default)

### Step 1.4: Enter Project Name

1. **Project name field**: Enter a name for your project
   - Example: `etl-workflow`, `etl-app`, `data-comparison-tool`
   - Use lowercase letters, hyphens, underscores
   - No spaces or special characters
   - Keep it descriptive and memorable

2. The **database name** auto-fills (usually project name in lowercase)

### Step 1.5: Select Region

1. **Region dropdown**: Choose a region closest to your location
   - Examples: `us-east-1`, `eu-central-1`, `ap-southeast-1`, `us-west-1`
   - Choose based on where most users are located
   - Affects database latency and compliance
   - For US users: `us-east-1` (recommended)
   - For Europe: `eu-central-1` (recommended)
   - For Asia: `ap-southeast-1` (recommended)

### Step 1.6: Create Database Password

⚠️ **IMPORTANT: Strong Password Required!**

1. **Password field**: Create a very strong database password
   - Minimum 12 characters (recommended: 16+ characters)
   - Mix of: Uppercase letters, lowercase letters, numbers, special characters
   - Example: `MyEtl@DB#Password2024!Secure`
   
   **Password Checklist:**
   - ✅ Contains uppercase: A-Z
   - ✅ Contains lowercase: a-z
   - ✅ Contains numbers: 0-9
   - ✅ Contains special characters: !@#$%^&*
   - ❌ NOT your name, email, or username
   - ❌ NOT sequential (123456, qwerty)
   - ❌ NOT words from dictionary
   - ✅ At least 12 characters long

2. **SAVE THIS PASSWORD IMMEDIATELY!**
   - Write it down in a password manager
   - Never share this password
   - You'll need it for database connections

### Step 1.7: Review Summary

Before creating:
- Project name: ✅ Correct
- Region: ✅ Correct
- Password: ✅ Strong and saved

### Step 1.8: Create Project

1. Click the **"Create new project"** button
2. You'll see: "Creating your project..." (loading screen)
3. **Wait 2-3 minutes** for initialization
   - This is normal - building database and API
   - Don't close the page or browser
   - You can see progress indicator

### Step 1.9: Project Created! 🎉

1. After 2-3 minutes, you'll be logged into your new project
2. You should see:
   - Project name at top
   - Navigation sidebar on left
   - Welcome message or "Getting Started" guide
   - Main dashboard area

3. Bookmark this URL for quick access: `https://app.supabase.com/projects`

## Step 2: Run Migration Script

### Step 2.1: Navigate to SQL Editor

1. You should be logged into your new Supabase project
2. Look at the **left sidebar** (left side of your screen)
3. You'll see a menu with various options:
   - Dashboard (top, with home icon)
   - SQL Editor (with brackets `< >` icon)
   - Database (with database icon)
   - Authentication (with user icon)
   - Storage (with folder icon)

4. Click on **"SQL Editor"** in the sidebar
5. The page will change to show SQL editing interface

### Step 2.2: Create New Query

1. In the **SQL Editor** section, look for **"New Query"** button
   - Usually in top-right area or top-left
   - May say "+ New Query" or "+ New"

2. Click **"New Query"** button
3. A new blank SQL editor window will open
4. You'll see empty white text area where you can paste SQL code

### Step 2.3: Get the Migration Script

1. On your computer, find the file: **`ETL_MIGRATION_SCRIPT.sql`**
   - This file should be in your project folder
   - Location: Same folder as `package.json`, `tsconfig.json`, etc.
   - If you don't have it, download from migration package

2. **Open the file:**
   - Right-click on `ETL_MIGRATION_SCRIPT.sql`
   - Select "Open with" → Text Editor (Notepad, VS Code, etc.)
   - The entire SQL script will display

3. **Select all content:**
   - Press `Ctrl + A` (Windows) or `Cmd + A` (Mac)
   - All text turns highlighted (usually blue background)

4. **Copy the content:**
   - Press `Ctrl + C` (Windows) or `Cmd + C` (Mac)
   - The entire script is now in your clipboard

### Step 2.4: Paste into SQL Editor

1. Click in the **SQL editor** window (blank white area)
2. Press `Ctrl + V` (Windows) or `Cmd + V` (Mac)
3. You'll see the entire migration script appears in the editor
   - Starts with comments (green text)
   - Contains CREATE TABLE statements
   - Contains CREATE FUNCTION statements
   - Contains CREATE POLICY statements

4. **Scroll down** to verify content is there:
   - Use scroll bar or Page Down key
   - You should see lines like:
     - `CREATE TABLE public.profiles (...)`
     - `CREATE TABLE public.projects (...)`
     - Several more CREATE TABLE statements

### Step 2.5: Run the Migration Script

1. Look for the **"Run"** button (top-right of SQL editor, usually blue button)
2. Click the **"Run"** button
3. **Wait** - the script is executing (1-2 minutes typically)
   - You'll see: "Executing query..." or similar message
   - At bottom may show progress

4. **Watch for completion:**
   - Look for green checkmark ✅ next to query name
   - Or look at the bottom-right for status indicator
   - Should say "Query succeeded" or similar

### Step 2.6: Verify Success

After execution completes:

1. **Check the output:**
   - Bottom of screen shows "Results" or "Messages" section
   - Look for messages confirming tables were created
   - Should see something like:
     - `CREATE TABLE completed successfully`
     - or `Query executed successfully`
     - No red error messages ❌

2. **Verify tables were created:**
   - Go to **Database** in left sidebar
   - Click **"Tables"** section
   - You should see these tables listed:
     - ✅ `profiles`
     - ✅ `projects`
     - ✅ `projects_members` (note: underscore, not hyphen)
     - ✅ `connections`
     - ✅ `saved_queries`
     - ✅ `reports`
     - ✅ `nocode_tests`
     - ✅ `nocode_test_executions`
     - ✅ `self_hosted_agents`
     - ✅ `agent_job_queue`
     - ✅ `agent_execution_results`
     - ✅ `agent_activity_logs`

3. **If all tables appear:** ✅ **Migration Successful!**

4. **If tables don't appear:**
   - Go back to SQL Editor
   - Check for error messages (red text)
   - Common errors:
     - "Column already exists" → Run in fresh project
     - "Function already exists" → Run in fresh project
     - Copy the error message
     - Run Step 2.4-2.5 again after fixing issue

### Step 2.7: Document Success

Record these details for reference:
- ✅ Date migration ran: `[Today's date]`
- ✅ Project name: `[Your project name]`
- ✅ All tables created
- ✅ No errors encountered

## Step 3: Get Connection Credentials

### Understanding the Credentials

You need **4 things** from Supabase:

| Name | What It Is | Where Used |
|------|-----------|-----------|
| **Project URL** | Your Supabase database address | `VITE_SUPABASE_URL` |
| **Project ID** | Unique identifier | `VITE_SUPABASE_PROJECT_ID` |
| **Anon Key** | Public key for app (safe to expose) | `VITE_SUPABASE_PUBLISHABLE_KEY` |
| **Service Role Key** | Secret key for backend (KEEP SECRET!) | `VITE_SUPABASE_SECRET_KEY` |

### Step 3.1: Navigate to Settings

1. Make sure you're logged into your Supabase project
2. Look at the **left sidebar** bottom area
3. You should see **"Settings"** with a gear icon ⚙️
4. Click on **"Settings"**
5. The page changes to show project settings

### Step 3.2: Find the API Keys Section

1. After clicking Settings, you're in **Settings > General** tab
2. Look at the **left sidebar under Settings:**
   - General
   - API
   - Database (with dropdown arrow)
   - Authentication
   - ... (other options)

3. Click on **"API"** in the left sidebar
4. Page changes to show API configuration

### Step 3.3: Copy Project URL

**Finding the URL:**

1. You should now be in **Settings > API** page
2. Look for a section titled **"Project URL"** or **"Your Project URL"**
3. You'll see a URL that looks like:
   ```
   https://xxxxxxxxxxxx.supabase.co
   ```
4. The `xxxxxxxxxxxx` part is your Project ID

**Copy the URL:**

1. Look for **Copy button** (icon or text) next to the URL
2. Or triple-click to select all the URL
3. Press `Ctrl + C` (Windows) or `Cmd + C` (Mac) to copy
4. **Save this somewhere temporarily:**
   - Open a text editor (Notepad, Word, etc.)
   - Paste the URL: `Ctrl + V` or `Cmd + V`
   - Label it: `VITE_SUPABASE_URL`
   - Example: `https://aokfxzwqpqoqpqoq.supabase.co`

### Step 3.4: Extract Project ID from URL

1. Look at your Project URL you just copied:
   - Example: `https://aokfxzwqpqoqpqoq.supabase.co`

2. The Project ID is the part between `https://` and `.supabase.co`
   - In example above: `aokfxzwqpqoqpqoq`

3. **Save the Project ID:**
   - In your text editor, add new line:
   - Label: `VITE_SUPABASE_PROJECT_ID`
   - Value: `aokfxzwqpqoqpqoq`

### Step 3.5: Copy Anon Key (Public Key)

In the **Settings > API** page:

1. Look for section titled **"Project keys"** or **"Anon public"**
2. You should see:
   - **`service_role secret`** - DO NOT COPY YET
   - **`anon public`** - Copy this one ✅

3. Find the **`anon public`** key:
   - It's a long string that looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - It's usually 200+ characters long

4. **Copy the anon key:**
   - Click the copy button next to `anon public`
   - Or manually select all and copy: `Ctrl + C`

5. **Save this:**
   - In your text editor, add new line:
   - Label: `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Value: paste the key (the long string)

### Step 3.6: Copy Service Role Key (Secret Key)

⚠️ **IMPORTANT: This is a SECRET - Never share it!**

In the same **Settings > API** page:

1. Look for **`service_role secret`** (labeled in red or with warning icon)
2. You should see a key that looks like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
3. It's similar to anon key but longer

4. **Copy the service role key:**
   - Click the copy button next to it
   - Or select all and copy: `Ctrl + C`

5. **Save this (SECURELY):**
   - In your text editor, add new line:
   - Label: `VITE_SUPABASE_SECRET_KEY`
   - Value: paste the key
   - ⚠️ **Important:** This should only exist in your `.env` file, NEVER in version control

### Step 3.7: Verify All Four Credentials

In your text editor, you should now have something like:

```
VITE_SUPABASE_URL = https://aokfxzwqpqoqpqoq.supabase.co
VITE_SUPABASE_PROJECT_ID = aokfxzwqpqoqpqoq
VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_SECRET_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Checklist (all must have values):**
- ✅ URL starts with `https://`
- ✅ URL ends with `.supabase.co`
- ✅ Project ID is the part between
- ✅ Publishable Key is long string starting with `ey...`
- ✅ Secret Key is long string starting with `ey...`
- ✅ Secret Key is DIFFERENT from Publishable Key

### Step 3.8: Store Credentials Safely

**Important:**
- ✅ Keep these credentials secure
- ❌ Never commit to GitHub
- ❌ Never share in email or chat
- ✅ Only share Secret Key with trusted backends
- ✅ Publishable Key is safe to expose (shown in browser)

## Step 4: Update Environment Variables (.env File)

### Understanding the .env File

**What is it?**
- A configuration file that stores secrets and settings
- Not tracked by Git (stays on your computer only)
- Loaded when your app starts
- Holds database credentials, API keys, etc.

**Why needed?**
- Your app reads these values at startup
- Allows different configurations for different environments (local, staging, production)
- Keeps secrets out of version control

### Step 4.1: Find or Create .env File

1. **Open your project folder** in your file explorer (Windows Explorer or Finder)
2. Location:
   - This should be the project folder
   - Same location as `package.json`, `src/`, `public/`, etc.

3. **Look for `.env` file:**
   - File name starts with dot: `.env`
   - On Windows, it might appear as just "env" (without dot) if extensions are hidden
   - On Mac/Linux, it's definitely `.env`

**If you find `.env` file:**
- Go to Step 4.3

**If you don't find `.env` file:**
- Look for `.env.example` file (template)
- This shows what variables you need
- If no `.env.example`, continue to Step 4.2

### Step 4.2: Create .env File

If no `.env` file exists:

1. **Create empty file:**
   - Right-click in the project folder (white space)
   - Select "New" → "Text Document" (Windows) or "New File" (Mac)
   - Name it exactly: `.env`
   - Press Enter

2. **Or create via code editor:**
   - Open VS Code (or any text editor)
   - Go to **File** → **Open Folder**
   - Select your project folder
   - Press `Ctrl + N` (Windows) or `Cmd + N` (Mac) to create new file
   - Type the filename: `.env`
   - Press Enter

3. You now have an empty `.env` file ✅

### Step 4.3: Add Supabase Credentials

1. **Open the `.env` file:**
   - Double-click to open with default editor
   - Or right-click → "Open with" → Notepad/VS Code

2. **Type or paste the following (update with YOUR values from Step 3):**

```env
VITE_SUPABASE_URL="https://aokfxzwqpqoqpqoq.supabase.co"
VITE_SUPABASE_PROJECT_ID="aokfxzwqpqoqpqoq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_SUPABASE_SECRET_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
VITE_API_BASE_URL="https://aokfxzwqpqoqpqoq.supabase.co/functions/v1/agent-api"
```

3. **Replace with YOUR actual values:**
   - `aokfxzwqpqoqpqoq` → Replace with YOUR Project ID from Step 3
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6I...` → Replace with YOUR Publishable Key from Step 3
   - `eyJhbGciOiJIUzI1NiIsInR5cCI6I...` → Replace with YOUR Secret Key from Step 3

**Example (with REAL values):**
```env
VITE_SUPABASE_URL="https://aokfxzwqpqoqpqoq.supabase.co"
VITE_SUPABASE_PROJECT_ID="aokfxzwqpqoqpqoq"
VITE_SUPABASE_PUBLISHABLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJodHRwczovL2FvayIsInB..."
VITE_SUPABASE_SECRET_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9eyJpc3MiOiJodHRwczovL2FvayIsInN..."
VITE_API_BASE_URL="https://aokfxzwqpqoqpqoq.supabase.co/functions/v1/agent-api"
```

### Step 4.4: Add Optional Configuration Variables

Add these for complete setup (optional but recommended):

```env
# Existing variables above...

# API Configuration
VITE_API_TIMEOUT=30000

# Enable debugging (optional, for development)
VITE_DEBUG=false

# Analytics (optional)
VITE_ENABLE_ANALYTICS=true
```

### Step 4.5: Save the File

1. Press `Ctrl + S` (Windows) or `Cmd + S` (Mac)
2. Or click **File** → **Save**
3. The file is now saved

### Step 4.6: Verify File Location

Your `.env` file should be in the **root** of your project:

```
project-folder/
├── .env                    ← New file here
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── src/
├── public/
├── tsconfig.json
└── ... (other files)
```

✅ If it's in this location, it will be loaded automatically!

### Step 4.7: .env File Security Checklist

Before continuing:

- ✅ `.env` file exists in project root
- ✅ Values have quotes: `"value"`
- ✅ No spaces around `=` sign like: `KEY = VALUE` ❌ (use `KEY="VALUE"` ✅)
- ✅ Each variable on its own line
- ✅ No variable is empty
- ✅ `.env` is in `.gitignore` (so it doesn't upload to GitHub)

### Step 4.8: Check .gitignore

Ensure `.env` is ignored by Git:

1. Find `.gitignore` file in project root
2. Open it
3. Look for line: `.env`
4. If not there, add it:
   - Go to end of file
   - Add new line: `.env`
   - Save file

This prevents accidentally uploading secrets to GitHub!

## Step 5: Update Supabase Client Configuration

### What is the Client Configuration?

**The client is:**
- The code that connects your app to Supabase
- Located in: `src/integrations/supabase/client.ts`
- Responsible for: Database operations, authentication, real-time features

**Why update it?**
- App needs to know where your database is
- Must use correct credentials from `.env` file
- Ensures all database operations work

### Step 5.1: Find the Client File

1. **Open VS Code** with your project
   - Or open file explorer and navigate to project folder

2. **Locate the file:**
   - Path: `src/integrations/supabase/client.ts`
   - Look in this order:
     - `src/` folder → `integrations/` → `supabase/` → `client.ts`

3. **Open the file:**
   - Double-click to open in VS Code
   - Or right-click → "Open with" → Text Editor

### Step 5.2: Verify Current Configuration

When you open `client.ts`, you should see something like:

```typescript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
```

**This is correct! ✅**
- It uses `import.meta.env` to read from `.env` file
- Don't need to change if it already looks like this

### Step 5.3: If Configuration is Different

If your file looks different (old version), you need to update it.

**Old version looks like:**
```typescript
// ❌ OLD VERSION - with hardcoded credentials
const SUPABASE_URL = "https://xxx.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGc...";
```

**Update it to:**
```typescript
// ✅ NEW VERSION - reads from .env
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

### Step 5.4: Make the Update

If needed:

1. **Find the lines with URL and Key:**
   - Use `Ctrl + F` (Windows) or `Cmd + F` (Mac) to search
   - Search for: `SUPABASE_URL`
   - It will highlight the line

2. **Select the old value:**
   - For URL line: Select everything between quotes: `"https://xxx.supabase.co"`
   - For Key line: Select everything between quotes

3. **Replace with import.meta.env:**
   - Delete the old value
   - Type: `import.meta.env.VITE_SUPABASE_URL`
   - For Key: `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`

4. **Your updated lines should look like:**
```typescript
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL !;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
```

### Step 5.5: Save the File

1. Press `Ctrl + S` (Windows) or `Cmd + S` (Mac)
2. Or click **File** → **Save**
3. File is now saved ✅

### Step 5.6: Verify Complete File

After updating, your complete `src/integrations/supabase/client.ts` should look like:

```typescript
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// Additional configuration (if present):
supabase.auth.onAuthStateChange((event, session) => {
  // Handle auth state changes
});
```

### Step 5.7: Checklist

- ✅ File: `src/integrations/supabase/client.ts` opened
- ✅ Line with SUPABASE_URL uses `import.meta.env.VITE_SUPABASE_URL`
- ✅ Line with SUPABASE_PUBLISHABLE_KEY uses `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`
- ✅ File saved (blue dot disappeared from file tab)
- ✅ No error messages in VS Code

**If all checkmarks are done:** ✅ Configuration updated!

## Step 6: Enable Authentication Setup

### Understanding Authentication

**What is it?**
- System for users to log in with email/password
- Supabase handles user management and JWT tokens
- Needed for: User profiles, project access control, data security

**Optional?**
- Yes, authentication is optional for basic use
- But strongly recommended for production
- Enables: Multi-user support, role-based access, audit trails

### Step 6.1: Navigate to Authentication Settings

1. Make sure you're logged into your Supabase project
2. Look at the **left sidebar**
3. Click **"Authentication"** (should have user icon 👤)
4. This opens Authentication management section

### Step 6.2: Enable Email/Password Provider

1. In Authentication section, click **"Providers"** or **"Provider Settings"**
2. You should see a list of providers:
   - Email ✉️
   - Google 🔍
   - GitHub 🐙
   - Discord
   - And others

3. Find **"Email"** provider
4. Click on it or click toggle to enable
5. You should see a toggle switch turn **ON** (usually green)

**Settings to review:**

When you click Email provider, you may see options:

- **Enable Email (Password) authentication**: ✅ TURN ON
- **Enable Email confirmations**: Toggle based on preference
  - ✅ ON = Users must confirm email before using
  - ❌ OFF = Users can use email immediately
  - Recommendation: Turn ON for production security

**Confirm Email Provider is Enabled:**
- You should see green checkmark or "Enabled" label next to Email
- If shown "Disabled", click to enable it

### Step 6.3: Configure Auth Redirect URLs

1. Still in Authentication section
2. Look for **"URL Configuration"** or **"Redirect URLs"**
3. Or go to **Settings** (gear icon) in Authentication section

**You need to add redirect URLs for your app.**

Click **"Add URL"** or similar button

Add these URLs (one by one):

1. **For Local Development:**
   ```
   http://localhost:5173
   ```
   (or whatever port your dev server uses)

2. **For Your Domain (if you have one):**
   ```
   https://yourdomain.com
   ```
   (replace `yourdomain.com` with your actual domain)

3. **For Localhost Alternatives:**
   ```
   http://127.0.0.1:5173
   ```

**How to add each:**
1. Click **"Add URL"** button
2. Paste the URL in the text field
3. Click **"Save"** or **"Add"**
4. Repeat for each URL

**Example redirect URLs list:**
```
http://localhost:5173
http://127.0.0.1:5173
https://myapp.com
https://www.myapp.com
```

### Step 6.4: Configure Site URL

1. In the same settings area, find **"Site URL"**
2. This is the main URL for your app
3. Enter (choose one):
   - For development: `http://localhost:5173`
   - For production: `https://yourdomain.com`

4. Click **"Save"** when done

### Step 6.5: Create Test User (Optional)

To test authentication without real user signup:

1. In **Authentication** section, click **"Users"**
2. You should see a list of users (probably empty)
3. Click **"Add user"** button (top-right)

**Fill in user details:**
1. **Email**: Enter test email (e.g., `test@example.com`)
2. **Password**: Enter temporary password (e.g., `TestPassword123!`)
3. **Auto-send sign-up confirmation**: 
   - ❌ Can uncheck this for local testing
   - ✅ Check it to send actual email

4. Click **"Create user"** button

**User is now created!** ✅

You can use these credentials to test login locally without needing real email verification.

### Step 6.6: Enable SMTP (for Production Email)

If you want to send real confirmation emails:

1. Go to **Authentication** → **Providers** → **Email Templates**
2. Or go to **Emails** section (if available)
3. Configure SMTP settings:
   - Email provider (SendGrid, Supabase built-in, etc.)
   - From email address
   - Sender name

This is optional for development, recommended for production.

### Step 6.7: Password Requirements (Optional Customization)

To set password requirements:

1. Go to **Authentication** → **Settings**
2. Look for **"Password Requirements"** or **"User Security"**
3. You can configure:
   - Minimum password length (default: 6, recommended: 12)
   - Require uppercase letters
   - Require numbers
   - Require special characters

4. Recommendation for security:
   ```
   Minimum length: 12 characters
   Uppercase: Required
   Numbers: Required
   Special characters: Recommended
   ```

5. Click **"Save"** when done

### Step 6.8: Enable Only Email/Password (Optional)

To disable other providers and only allow Email signup:

1. Go to **Authentication** → **Providers**
2. Disable providers you don't want:
   - Click on each provider
   - Toggle OFF to disable
   - Keep only **Email** enabled

This way users can only sign up via email/password.

### Step 6.9: Verify Email Auth is Working

Before moving forward:

- ✅ Email provider is ENABLED (green checkmark)
- ✅ Redirect URLs are added (at least localhost)
- ✅ Site URL is configured
- ✅ If created test user: user appears in Users list

**You're ready to test login in the app!**

## Step 7: Storage Configuration Review

### Storage Buckets

**What was created in migration:**

The migration script automatically created:

1. **`reports` bucket** (Private)
   - Purpose: Store ETL comparison results
   - Security: Private (only authenticated users can access)
   - Quota: Depends on Supabase plan
   - Files: Store generated comparison reports here

### Verify Storage is Ready

1. Go to your Supabase project
2. In left sidebar, click **"Storage"**
3. You should see:
   - ✅ `reports` bucket listed
   - Status: Active/Ready
   - Access level: Private

4. Click on **`reports`** bucket
5. Should show empty or with some files
6. This means storage is working! ✅

### Storage Rules (Already Configured)

The migration script pre-configured security rules:

- ✅ Users can upload files only to their own project folder
- ✅ Users can download their own files
- ✅ Admin can manage all files
- ✅ Private bucket prevents unauthorized access

**No additional configuration needed!**

### Testing Storage (Optional)

To verify storage works:

1. In **Storage** section, click **`reports` bucket**
2. Click **"Upload File"** → Upload a small test file
3. File should appear in the bucket
4. Click on file → **"Delete"** to remove
5. Confirm deletion works

✅ Storage is ready to accept ETL comparison results!

## Step 8: Test Everything and Start Working

### Step 8.1: Install Dependencies

First, make sure all Node.js dependencies are installed.

1. **Open Terminal in your project:**
   - In VS Code: `Ctrl + `` ` (backtick) or View → Terminal
   - Or open Command Prompt/PowerShell, navigate to project folder

2. **Type this command:**
   ```bash
   npm install
   ```

3. **What it does:**
   - Reads `package.json`
   - Downloads all required packages
   - Installs them in `node_modules/` folder
   - Creates `package-lock.json`

4. **Wait for completion:**
   - Takes 2-5 minutes
   - You should see: `added X packages` at the end
   - No red error messages ❌ (some warnings are OK)

5. **If errors occur:**
   - Try: `npm install --force`
   - Or: `npm clean-install`

### Step 8.2: Start Development Server

After npm install completes:

1. **In the same terminal, type:**
   ```bash
   npm run dev
   ```

2. **What happens:**
   - Starts local development server
   - Compiles your code
   - Opens app at: `http://localhost:5173`
   - Watches for file changes

3. **Expected output:**
   ```
   > test-toast-site@0.0.1 dev
   > vite
   
   VITE v5.0.0  ready in XXX ms
   
   ➜  Local:   http://localhost:5173/
   ➜  press h to show help
   ```

4. **If you see errors:**
   - See troubleshooting below
   - Don't close terminal yet

### Step 8.3: Open Your App in Browser

1. **Open web browser** (Chrome, Firefox, Safari, Edge)
2. **Go to:** `http://localhost:5173`
3. **You should see:**
   - Your ETL app loads
   - Dashboard appears
   - No red error banners

**If app loaded successfully:** ✅ **Your setup works!**

### Step 8.4: Check Browser Console for Errors

Even if app looks okay, check for errors:

1. **Open Browser Developer Tools:**
   - Press `F12` or `Ctrl + Shift + I` (Windows)
   - Or right-click → "Inspect" → "Console" tab

2. **Look for red messages:**
   - ✅ Some warnings are OK (yellow)
   - ❌ Red errors mean problems

3. **Common errors to look for:**
   - `VITE_SUPABASE_URL is undefined` → `.env` file missing or wrong
   - `Failed to fetch from supabase` → Network or credentials wrong
   - `Cors policy` → Origin not allowed in Supabase

### Step 8.5: Test Supabase Connection

To verify Supabase is connected:

1. **In browser console (F12), type:**
   ```javascript
   console.log(import.meta.env.VITE_SUPABASE_URL)
   ```
   Press Enter

2. **You should see:**
   ```
   https://aokfxzwqpqoqpqoq.supabase.co
   ```
   (Your actual project URL)

3. **If showing `undefined`:**
   - `.env` file not found
   - Check file exists in project root
   - Restart dev server: `Ctrl + C` then `npm run dev` again

### Step 8.6: Test Database Connection

1. **In browser console, type:**
   ```javascript
   supabase.auth.getSession().then(data => console.log(data))
   ```
   Press Enter

2. **You should see:**
   ```javascript
   { data: { session: null }, error: null }
   ```
   (or with session if logged in)

3. **If you see errors:**
   - Check Supabase credentials are correct
   - Verify database is created with migration script
   - Check internet connection

### Step 8.7: Test Database Tables

To verify your migration script worked:

1. **Go back to Supabase dashboard**
2. **Go to: SQL Editor**
3. **Create new query with:**
   ```sql
   SELECT * FROM public.profiles LIMIT 1;
   ```

4. **Click "Run"**
5. **You should see:**
   - Query returns 0 rows (OK, no users yet)
   - No error messages

6. **If error like "relation does not exist":**
   - Migration script didn't run properly
   - Go back to Step 2 and re-run it
   - Or verify all tables in Database → Tables section

### Step 8.8: Detailed Troubleshooting

#### Error: "Cannot find VITE_SUPABASE_URL"

**Problem:** App can't find Supabase credentials
**Solutions:**
1. Check `.env` file exists in project root
2. Verify file name is exactly: `.env` (not `.env.local`)
3. Check `.env` has all 5 variables with values
4. Restart dev server: `Ctrl + C` in terminal, then `npm run dev`
5. Hard refresh browser: `Ctrl + Shift + R` or `Cmd + Shift + R`

#### Error: "Failed to fetch from supabase"

**Problem:** Connection to Supabase server failing
**Solutions:**
1. Verify internet connection
2. Check Supabase project status:
   - Go to: https://status.supabase.com
   - Are there any outages?
3. Verify credentials in `.env`:
   - URL matches: `https://[PROJECT-ID].supabase.co`
   - Keys are complete (not truncated)
4. Check Supabase API settings:
   - Go to Supabase → Settings → API
   - Verify keys are valid (not expired/revoked)
5. Test Supabase REST API directly:
   - In browser go to: `https://[PROJECT-ID].supabase.co/rest/v1/profiles?select=*`
   - Or try in Supabase SQL Editor

#### Error: "CORS policy blocked request"

**Problem:** Browser blocked cross-origin request
**Solutions:**
1. Verify app URL is in Supabase redirect URLs:
   - Go to: Supabase → Authentication → URL Configuration
   - Check: `http://localhost:5173` is listed
   - If not, add it
2. Check Site URL is set:
   - Supabase → Authentication → Settings
   - Site URL should be: `http://localhost:5173`
3. Verify Supabase project allows your origin:
   - Some projects have stricter CORS
   - Check project settings

#### Error: "Tables do not exist"

**Problem:** Migration script didn't create tables
**Solutions:**
1. Go to Supabase → Database → Tables
2. Check if these exist:
   - `profiles`, `projects`, `project_members`, `connections`
   - If not, migration didn't run
3. Run migration again:
   - Go to SQL Editor
   - Create new query
   - Paste entire ETL_MIGRATION_SCRIPT.sql
   - Click "Run"
   - Wait for completion
4. Check for specific errors in SQL output
5. If still failing, create fresh Supabase project and retry

#### Error: "Auth not working / can't log in"

**Problem:** Authentication configuration incomplete
**Solutions:**
1. Verify Email provider is enabled:
   - Supabase → Authentication → Providers
   - Email should be ON (green checkmark)
2. Verify redirect URLs:
   - Supabase → Authentication → URL Configuration
   - Must include: `http://localhost:5173`
3. Check email confirmation setting:
   - Supabase → Authentication → Providers → Email
   - May need to disable "Email confirmation" for testing locally
4. Try creating test user:
   - Supabase → Authentication → Users → Add user
   - Add manual test user
   - Try logging in with that user
5. Check app code:
   - App must call `supabase.auth.signInWithPassword()`
   - Verify login component is implemented

#### Warning: "localStorage/sessionStorage warnings"

**Problem:** Storage-related console warnings
**Solution:**
- These are usually safe to ignore in development
- May appear in private browsing mode
- App still works normally

### Step 8.9: Verify Each Feature Works

#### Test 1: Dashboard Loads
- ✅ You see main page/dashboard
- ✅ No red error bars at top
- ✅ Page is responsive (not broken layout)

#### Test 2: Can Access Panels
- ✅ Click on navigation menu items
- ✅ Panels load without errors
- ✅ Content displays correctly

#### Test 3: Upload Mapping Sheet
- ✅ Go to Upload section
- ✅ Select or drag a CSV/Excel file
- ✅ File uploads without errors
- ✅ Columns are recognized

#### Test 4: Generate Tests
- ✅ After uploading, can generate tests
- ✅ Test cases appear
- ✅ Test execution starts

#### Test 5: View Reports
- ✅ After execution, can view results
- ✅ Reports display with data
- ✅ Can download/export results

### Step 8.10: Final Checklist

Before declaring setup complete, verify:

- ✅ `.env` file exists with all 4 Supabase credentials
- ✅ Dev server running: `npm run dev`
- ✅ App loads at: `http://localhost:5173`
- ✅ No Supabase connection errors
- ✅ No red error messages in console (F12)
- ✅ All database tables exist in Supabase
- ✅ Can access all main menu sections
- ✅ Browser shows HTTPS/secure (if deployed)

**If all checkmarks are complete:** ✅ **YOUR SETUP IS COMPLETE AND WORKING!**

### Step 8.11: Troubleshoot Remaining Issues

If something still doesn't work:

1. **Collect error information:**
   - Note exact error message
   - Screenshot browser console (F12)
   - Screenshot Supabase error (if applicable)
   - Copy exact steps to reproduce

2. **Common checklist:**
   - ✅ Restarted dev server recently?
   - ✅ Refreshed browser (Ctrl + F5)?
   - ✅ Checked `.env` file exists?
   - ✅ Internet connection working?
   - ✅ No firewall blocking Supabase?

3. **Ask for help with these details:**
   - Exact error message (copy/paste from console)
   - Screenshot of the issue
   - Your operating system (Windows/Mac/Linux)
   - Browser being used (Chrome/Firefox/etc.)
   - Steps you already tried

## Important Notes

### ⚠️ Security
- **NEVER commit** `.env` file with secrets to version control
- Keep `VITE_SUPABASE_SECRET_KEY` secret
- Use environment-specific configuration for production
- Enable RLS (Row Level Security) policies in production

### 🗄️ Database Schema
All tables have RLS enabled by default. Policies allow:
- Project members to access their project data
- Users to manage their own profiles
- Secure access patterns for agents

### 🔧 Optional: Deploy Supabase Functions
If you plan to use edge functions:
1. Go to **Edge Functions > Create Function**
2. Deploy your functions from `supabase/functions/`

### 📊 Optional: Enable Realtime (Real-Time Data Sync)
1. Go to **Realtime > Replication**
2. Enable tables you want to sync in real-time:
   - `connections` (for live connection updates)
   - `reports` (for live comparison results)
   - `self_hosted_agents` (for agent status updates)

## Tables Reference

| Table | Purpose |
|-------|---------|
| `profiles` | User profile information |
| `projects` | Project metadata |
| `project_members` | Project membership and roles |
| `connections` | Database connection configurations |
| `saved_queries` | Saved SQL queries |
| `reports` | ETL comparison results |
| `nocode_tests` | No-code automation tests |
| `nocode_test_executions` | Test execution history |
| `self_hosted_agents` | Agent registry |
| `agent_job_queue` | Job queue for agents |
| `agent_execution_results` | Execution results |
| `agent_activity_logs` | Audit trail |

## Troubleshooting Reference

**For detailed troubleshooting steps, see:** [Step 8.8: Detailed Troubleshooting](#step-88-detailed-troubleshooting)

### Quick Reference Checklist

#### ⚠️ App Won't Start / "npm run dev" Fails

- [ ] `npm install` completed successfully
- [ ] No error messages in terminal (warnings OK)
- [ ] `.env` file exists in project root
- [ ] All 5 environment variables have values
- [ ] Restart Terminal and try again
- [ ] Try: `npm cache clean --force` then `npm install`

#### ⚠️ App Loads But Shows Errors

- [ ] Open Browser DevTools: `F12`
- [ ] Check Console tab for red errors
- [ ] Look for: "VITE_SUPABASE_URL undefined"
- [ ] Check Supabase URL is correct in `.env`
- [ ] Hard refresh: `Ctrl + Shift + R` or `Cmd + Shift + R`
- [ ] Clear browser cache (if persists)

#### ⚠️ Can't Connect to Supabase

**Check these in order:**
1. **Internet connection** - Are you online?
2. **Credentials correct** - Check `.env` values match Supabase
3. **Project URL** - Should be `https://[ID].supabase.co`
4. **Keys not truncated** - Full key values pasted?
5. **Supabase status** - Check https://status.supabase.com
6. **Firewall/VPN** - Any network restrictions?

#### ⚠️ Database Tables Don't Exist

1. Go to Supabase → Database → Tables
2. If empty or missing tables:
   - Go back to Step 2
   - Re-run migration script
   - Check SQL output for errors
   - Try in fresh Supabase project

#### ⚠️ Authentication Not Working (Can't Log In)

**Follow these steps:**
1. Check Email provider enabled: Supabase → Authentication → Providers
2. Add redirect URL: Supabase → Authentication → URL Configuration → Add `http://localhost:5173`
3. Create test user: Supabase → Authentication → Users → Add user
4. Try logging in with test user credentials
5. Check browser console for auth errors

#### ⚠️ File Upload Fails

- [ ] File format correct (CSV or Excel)
- [ ] File size not too large (< 50MB)
- [ ] Columns in expected format
- [ ] Try with sample file first
- [ ] Check storage bucket exists and is writable

#### ⚠️ "CORS" or "Origin Not Allowed" Error

**This means Supabase is blocking your app. Fix:**
1. Go to Supabase → Authentication → URL Configuration
2. Add your app URL: `http://localhost:5173`
3. Also add for production later: `https://yourdomain.com`
4. Wait 30 seconds for changes to apply
5. Refresh browser

## Support Resources

### Get Help

If you're stuck:

1. **Check Supabase Logs:**
   - Supabase → Settings → Logs
   - Look for error messages
   - Timestamps match when issue occurred?

2. **Test Database Directly:**
   - Supabase → SQL Editor
   - Run: `SELECT version();`
   - If works, database is OK
   - Run: `SELECT * FROM public.profiles;`
   - If works, migration script ran

3. **Test API Endpoint:**
   - In browser, visit:
   - `https://[PROJECT-ID].supabase.co/rest/v1/profiles?select=*`
   - Should show JSON or error
   - If "forbidden", it's an RLS policy issue

4. **Clear Local Data:**
   - Browser DevTools (F12) → Application → Storage
   - Delete: localStorage, sessionStorage, cookies
   - Clear browser cache
   - Try again

### Common Issues Reference

| Issue | Cause | Fix |
|-------|-------|-----|
| "undefined is not a function" | Import error | Check file paths, restart dev server |
| "Failed to fetch" | Network error | Check internet, Supabase status |
| "CORS error" | Origin blocked | Add URL to Supabase authentication |
| "Table does not exist" | Migration didn't run | Run Step 2 again |
| "Email verification required" | Auth config | Create test user in Supabase |
| "RLS policy preventing access" | Permissions | Check user is project member |
| "Port 5173 already in use" | Port conflict | Kill other process or change port |
| "VITE_SUPABASE_URL undefined" | `.env` missing | Create `.env` in project root |

## Next Steps - After Setup Complete

Once you've verified everything works:

### 1. Create First Project
1. Log in or sign up
2. Click "New Project" in app
3. Enter project name
4. Create database connections

### 2. Upload Mapping Sheets
1. Go to "Connections" or "Upload" section
2. Select your mapping sheet file
3. Column mapping appears
4. Review and validate

### 3. Generate Test Cases
1. In comparison view, select mapping sheet
2. Click "Generate Tests"
3. Test cases appear with expected/actual columns
4. Review for accuracy

### 4. Run Executors (Optional)
1. Execute tests against real database
2. See pass/fail results
3. Generate reports
4. Export results

### 5. Deploy (If Using Agents)
1. Configure self-hosted agent (if needed)
2. Deploy Docker container
3. Agent picks up jobs from queue
4. Automate testing process

## Deployment Guide (Production)

When ready to deploy to production:

1. **Create production Supabase project**
2. **Run migration script on production**
3. **Generate new credentials for production**
4. **Create `.env.production` file**
5. **Deploy to hosting** (Vercel, Netlify, etc.)
6. **Enable SSL/HTTPS**
7. **Add production URLs to Supabase auth**
8. **Set up monitoring and logging**
9. **Configure backup strategy**
10. **Document deployment process**

## Maintenance Checklist

**Monthly:**
- Review Supabase logs for errors
- Check storage usage
- Verify backups working
- Test disaster recovery

**Quarterly:**
- Security audit
- Dependency updates
- Performance review
- User access review

**Annually:**
- Full system review
- Architecture assessment
- Capacity planning
- Contract renewal checks

---

**Version**: 2.0  
**Last Updated**: April 2, 2026  
**Total Setup Time**: 30-60 minutes (including all account creation)
