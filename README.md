# Auto Beli

Auto Beli groups meal photos, matches them to nearby restaurants, drafts an editable review in your style, and helps add the complete review to Beli.

See [MVP_STATUS.md](MVP_STATUS.md) for the current end-to-end flow, known limitations, and recommended probes.

## Requirements

- A Mac with iPhone Mirroring set up
- Beli installed and signed in on the connected iPhone
- Node.js 22 or newer
- pnpm 10.15.1
- A Google Maps API key with Places API (New) enabled
- One of these options for photo labeling and review drafting:
  - Codex CLI 0.144.0 or newer, installed and signed in
  - An OpenRouter API key

## Setup

1. Clone the repository.

   ```bash
   git clone <repository-url>
   cd auto-beli
   ```

2. Install and select the correct Node.js version.

   ```bash
   nvm install
   nvm use
   ```

3. Enable pnpm.

   ```bash
   corepack enable
   corepack prepare pnpm@10.15.1 --activate
   ```

4. Install the project packages.

   ```bash
   pnpm install
   ```

5. Create a `.env.local` file in the project folder.

   ```bash
   touch .env.local
   ```

6. Add your Google Maps API key to `.env.local`.

   ```bash
   GOOGLE_MAPS_PLACES_API_KEY=your_google_maps_api_key
   ```

7. Set up photo labeling.

   - To use Codex CLI:

     ```bash
     codex --version
     codex login
     ```

   - Or add an OpenRouter API key to `.env.local`:

     ```bash
     OPENROUTER_API_KEY=your_openrouter_api_key
     ```

   - You can configure both for photo labeling. Review drafting uses the locally signed-in Codex CLI so it can run without a separate AI API key.

8. Install the Xcode command-line tools for the Beli automation.

   ```bash
   xcode-select --install
   ```

9. Give the terminal app that runs Auto Beli these macOS permissions:

   - Open **System Settings → Privacy & Security**.
   - Enable **Accessibility**.
   - Enable **Screen & System Audio Recording**.
   - Restart the terminal app after changing the permissions.

## Run the project

1. Start the development server.

   ```bash
   pnpm dev
   ```

2. Open [http://localhost:3000](http://localhost:3000).

3. Stop the server when you are done.

   ```text
   Control+C
   ```

## Run a production build

1. Build the project.

   ```bash
   pnpm build
   ```

2. Start the production server.

   ```bash
   pnpm start
   ```

3. Open [http://localhost:3000](http://localhost:3000).

## Logs

- Each labeling run creates a folder inside `logs/`.
- Logs include Places results, the selected labeling provider, model results, and errors.
- Photo data is not written to the logs.
