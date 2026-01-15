# CatchBot

A NestJS application for monitoring and capturing crash game results from BC.Game. The bot automatically connects to Chrome via remote debugging, monitors crash game results, and saves them to CSV files.

## Features

- 🚀 **Automatic Chrome Management**: Launches Chrome with remote debugging enabled
- 📊 **Crash Result Monitoring**: Monitors and captures crash game results in real-time
- 💾 **CSV Export**: Automatically saves crash results to date-based CSV files
- 🔌 **REST API**: Full REST API for manual control and monitoring
- 🛡️ **Graceful Shutdown**: Properly handles shutdown signals and cleans up resources
- ⚙️ **Configurable**: Extensive environment variable configuration

## Installation

```bash
npm install
```

## Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
PORT=8001

# Chrome Debug Configuration
DEBUG_PORT=9225
CHROME_TARGET_URL=https://bc.game/en/game/crash?type=classic
CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP=true

# Monitoring Configuration
MONITOR_INTERVAL=500

# CSV Configuration
CSV_RESULTS_DIR=./results
```

### Environment Variable Details

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8001` | Port for the NestJS HTTP server |
| `DEBUG_PORT` | `9225` | Chrome remote debugging port |
| `CHROME_TARGET_URL` | `https://bc.game/en/game/crash?type=classic` | URL to open in Chrome |
| `CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP` | `true` | Whether to close Chrome when bot stops (`true`/`false`) |
| `MONITOR_INTERVAL` | `500` | Interval in milliseconds to check for new crash results |
| `CSV_RESULTS_DIR` | `./results` | Directory where CSV files will be saved |

## Running the App

### Development Mode

```bash
npm run start:dev
```

### Production Mode

```bash
npm run build
npm run start:prod
```

### Debug Mode

```bash
npm run start:debug
```

## How It Works

1. **Startup**: When the application starts, it automatically:
   - Launches Chrome with remote debugging on the configured port
   - Waits for Chrome to be ready
   - Connects to Chrome using Puppeteer
   - Waits for the crash banner to appear
   - Starts monitoring crash results

2. **Monitoring**: The bot continuously monitors the crash game page for new results:
   - Checks for new crash results at the configured interval
   - Extracts game ID and multiplier from each result
   - Automatically saves results to CSV files

3. **CSV Files**: Results are saved to date-based CSV files:
   - Format: `M-D.csv` (e.g., `1-15.csv` for January 15th)
   - Automatically switches to a new file when the date changes
   - Located in the `CSV_RESULTS_DIR` directory

4. **Shutdown**: When the application stops (Ctrl+C or SIGTERM):
   - Stops monitoring
   - Disconnects from Chrome
   - Optionally closes Chrome (based on `CLOSE_DEBUG_BROWSER_WHEN_BOT_STOP`)

## API Endpoints

### Main Endpoints

- `GET /` - Health check endpoint
- `GET /env-example` - Get example environment configuration
- `POST /start` - Manually start crash result monitoring
- `POST /stop` - Manually stop crash result monitoring

### Crash Endpoints

- `GET /crash/connect` - Connect to Chrome browser
- `GET /crash/last-result` - Get the last crash result
  - Query parameter: `?save=true` - Also save result to CSV
- `GET /crash/all-results` - Get all crash results from history bar
- `GET /crash/balance` - Get account balance
- `POST /crash/monitor` - Start monitoring crash results
  - Query parameter: `?save=true` - Automatically save results to CSV
- `POST /crash/monitor/stop` - Stop monitoring

### Example API Usage

```bash
# Start monitoring with CSV saving
curl -X POST http://localhost:8001/crash/monitor?save=true

# Get last crash result
curl http://localhost:8001/crash/last-result

# Get account balance
curl http://localhost:8001/crash/balance

# Stop monitoring
curl -X POST http://localhost:8001/crash/monitor/stop
```

## Project Structure

```
src/
├── app.module.ts              # Main application module
├── app.controller.ts          # Main API controller
├── app.service.ts             # Main service
├── app-bootstrap.service.ts    # Application startup orchestration
├── main.ts                    # Application entry point
├── chrome/
│   ├── chrome.module.ts       # Chrome module
│   └── chrome-manager.service.ts  # Chrome browser management
├── crash/
│   ├── crash.module.ts        # Crash module
│   ├── crash.controller.ts    # Crash API endpoints
│   └── crash-result-catcher.service.ts  # Crash result extraction
├── csv/
│   ├── csv.module.ts          # CSV module
│   └── csv-handler.service.ts # CSV file management
└── shutdown/
    ├── shutdown.module.ts     # Shutdown module
    └── shutdown-handler.service.ts  # Graceful shutdown handling
```

## CSV File Format

CSV files are created with the following format:

```csv
gameId,multiplier,timestamp
12345,   1.23,  01:15T10:30:45
12346,   2.45,  01:15T10:31:12
```

- **gameId**: The game ID from BC.Game
- **multiplier**: The crash multiplier (padded to 6 characters)
- **timestamp**: Timestamp in format `MM:DDTHH:mm:ss`

## Troubleshooting

### Port Already in Use

If you get an `EADDRINUSE` error:

1. **Find the process using the port:**
   ```powershell
   netstat -ano | findstr :8001
   ```

2. **Kill the process:**
   ```powershell
   taskkill /F /PID <PID>
   ```

3. **Or use a different port:**
   ```env
   PORT=8001
   ```

### Chrome Not Starting

- Ensure Google Chrome is installed
- Check that the Chrome path is correct (defaults to common Windows locations)
- Verify `DEBUG_PORT` is not already in use

### Crash Banner Not Found

- Ensure you're logged into BC.Game
- Check that the page has loaded completely
- Increase the timeout in `waitForCrashBanner()` if needed

### CSV Files Not Created

- Check that `CSV_RESULTS_DIR` directory exists or can be created
- Verify write permissions for the results directory
- Check application logs for errors

## Development

### Building

```bash
npm run build
```

### Linting

```bash
npm run lint
```

### Formatting

```bash
npm run format
```

## Testing

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```

## License

Private
