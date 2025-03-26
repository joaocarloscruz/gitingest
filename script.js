document.addEventListener('DOMContentLoaded', () => {
    const folderInput = document.getElementById('folderInput');
    const statusDisplay = document.getElementById('status');
    const outputArea = document.getElementById('output');
    const copyButton = document.getElementById('copyButton');

    // --- New UI Elements ---
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');
    // --- End New UI Elements ---

    // --- Configuration ---
    // Default max size (will be updated by slider)
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;

    // Common binary file extensions to ignore (add more if needed)
    const BINARY_EXTENSIONS = new Set([
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', // Images
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp', // Documents
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', // Archives
        '.exe', '.dll', '.so', '.dylib', '.app', '.dmg', // Executables/Binaries
        '.mp3', '.wav', '.ogg', '.mp4', '.avi', '.mov', '.webm', // Audio/Video
        '.class', '.jar', // Java bytecode
        '.pyc', '.pyd', // Python bytecode
        '.lock', // Lock files
        '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot' // Assets/Fonts
    ]);

    // Directories/files to always ignore (these override include/exclude)
    const ALWAYS_IGNORE_PATTERNS = [
        '.git/',
        'node_modules/',
        'dist/',
        'build/',
        'coverage/',
        '__pycache__/',
        '*.pyc',
        '.DS_Store',
        'Thumbs.db'
    ].map(p => ({ pattern: p, isDir: p.endsWith('/') })); // Pre-process for efficiency
    // --- End Configuration ---

    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;

    // --- Event Listeners ---
    folderInput.addEventListener('change', handleFolderSelect);
    copyButton.addEventListener('click', copyOutputToClipboard);

    // Update max size and display when slider changes
    maxSizeSlider.addEventListener('input', () => {
        const kbValue = parseInt(maxSizeSlider.value);
        currentMaxSizeBytes = kbValue * 1024;
        maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);

        // Update slider track gradient dynamically
        const percentage = (kbValue / parseInt(maxSizeSlider.max)) * 100;
        maxSizeSlider.style.setProperty('--value-percent', `${percentage}%`);

        // Note: If files are already loaded, changing the slider won't re-filter
        // until the folder is selected again. This is simpler behavior.
    });

    // Update filter mode when dropdown changes
    filterModeSelect.addEventListener('change', () => {
        currentFilterMode = filterModeSelect.value;
         // Also doesn't re-filter automatically
    });

    // Update user patterns when input changes (we parse them during processing)
    // filterPatternsInput.addEventListener('input', ...) // No immediate action needed

    // --- Initial Setup ---
    // Set initial slider display and background
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
    const initialPercentage = (parseInt(maxSizeSlider.value) / parseInt(maxSizeSlider.max)) * 100;
    maxSizeSlider.style.setProperty('--value-percent', `${initialPercentage}%`);


    // --- Core Logic ---

    async function handleFolderSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            statusDisplay.textContent = 'No folder selected or folder is empty.';
            outputArea.value = '';
            copyButton.disabled = true;
            return;
        }

        statusDisplay.textContent = `Preparing... Reading filters...`;
        outputArea.value = 'Processing... Please wait.\n';
        copyButton.disabled = true;
        gitignoreRules = []; // Reset rules for new selection
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value); // Parse user patterns now
        currentFilterMode = filterModeSelect.value; // Get current mode

        // Sort files to process .gitignore first if possible (best effort)
        const sortedFiles = Array.from(files).sort((a, b) => {
            if (a.webkitRelativePath.endsWith('/.gitignore')) return -1;
            if (b.webkitRelativePath.endsWith('/.gitignore')) return 1;
            return a.webkitRelativePath.localeCompare(b.webkitRelativePath);
        });

        // Find and parse .gitignore at the root
        const gitignoreFile = sortedFiles.find(f => f.webkitRelativePath.split('/').length === 2 && f.name === '.gitignore');
        if (gitignoreFile) {
            try {
                statusDisplay.textContent = 'Reading .gitignore...';
                const gitignoreContent = await readFileContent(gitignoreFile, true); // Allow reading .gitignore even if > size limit
                gitignoreRules = parseGitignore(gitignoreContent);
                 statusDisplay.textContent = `Found ${gitignoreRules.length} rules in .gitignore. Processing files...`;
            } catch (error) {
                console.error("Error reading .gitignore:", error);
                statusDisplay.textContent = 'Could not read .gitignore, proceeding without it. Processing files...';
            }
        } else {
             statusDisplay.textContent = 'No .gitignore found at root. Processing files...';
        }


        let combinedOutput = '';
        let processedFileCount = 0;
        let ignoredFileCount = 0;
        const totalFiles = sortedFiles.length;
        const fileProcessingPromises = [];

        statusDisplay.textContent = `Analyzing ${totalFiles} items...`;
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI update

        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            const filePath = file.webkitRelativePath; // e.g., "my-repo/src/main.js"
            const relativePathInRepo = filePath.substring(filePath.indexOf('/') + 1);

            // Run filter checks (more efficient than reading every file first)
            if (!shouldProcessFile(relativePathInRepo, file.size, file.name)) {
                ignoredFileCount++;
                continue;
            }

            // If it passes filters, add a promise to read it
            fileProcessingPromises.push(
                readFileContent(file)
                    .then(content => {
                        return { path: relativePathInRepo, content: content };
                    })
                    .catch(error => {
                        console.warn(`Skipping file ${relativePathInRepo}: ${error.message}`);
                        ignoredFileCount++; // Count as ignored if read fails (e.g., binary detection during read)
                        return null; // Indicate failure
                    })
            );

             // Update status periodically during analysis phase
            if (i % 100 === 0 || i === totalFiles - 1) {
                 statusDisplay.textContent = `Analyzing item ${i + 1}/${totalFiles}... (Ignored so far: ${ignoredFileCount})`;
                 await new Promise(resolve => setTimeout(resolve, 0)); // Prevent freezing
            }
        }

        statusDisplay.textContent = `Reading ${fileProcessingPromises.length} filtered files...`;
        await new Promise(resolve => setTimeout(resolve, 0));

        // Process reads concurrently
        const results = await processPromisesBatch(fileProcessingPromises, 10, (done, total) => {
            statusDisplay.textContent = `Reading file ${done}/${total}...`;
        });


        // Combine results
        results.forEach(result => {
            if (result && result.content !== null) { // Check for null results from read errors
                combinedOutput += `--- FILENAME: ${result.path} ---\n`;
                combinedOutput += result.content;
                combinedOutput += '\n\n';
                processedFileCount++;
            } else if (result === null) {
                // Already counted as ignored if readFileContent failed
            }
        });

        // Final status update needs accurate ignored count
        ignoredFileCount = totalFiles - processedFileCount;

        outputArea.value = combinedOutput;
        statusDisplay.textContent = `Done. Processed ${processedFileCount} files. Ignored ${ignoredFileCount} items. Total items: ${totalFiles}.`;
        copyButton.disabled = combinedOutput.length === 0;

        folderInput.value = null; // Allow selecting the same folder again
    }

     // Helper to process promises in batches with progress callback
    async function processPromisesBatch(promises, batchSize, progressCallback) {
        let results = [];
        let index = 0;
        while (index < promises.length) {
            const batch = promises.slice(index, index + batchSize);
            const batchResults = await Promise.all(batch);
            results = results.concat(batchResults);
            index += batchSize;
            if (progressCallback) {
                progressCallback(Math.min(index, promises.length), promises.length);
            }
             await new Promise(resolve => setTimeout(resolve, 0)); // Yield to main thread
        }
        return results;
    }


    function readFileContent(file, ignoreSizeLimit = false) {
        return new Promise((resolve, reject) => {
            if (!ignoreSizeLimit && file.size > currentMaxSizeBytes) {
                return reject(new Error(`File size (${(file.size / 1024 / 1024).toFixed(2)}MB) exceeds limit of ${formatSize(currentMaxSizeBytes)}`));
            }
            // Binary check based on extension is now done in shouldProcessFile

            const reader = new FileReader();
            reader.onload = (event) => {
                if (event.target.result && event.target.result.includes('\u0000')) {
                    reject(new Error(`Detected null byte, likely a binary file: ${file.name}`));
                } else {
                    resolve(event.target.result);
                }
            };
            reader.onerror = (event) => {
                reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
            };
            reader.readAsText(file);
        });
    }

    function parseUserPatterns(patternsString) {
        if (!patternsString) return [];
        return patternsString
            .split(',')
            .map(p => p.trim())
            .filter(p => p); // Remove empty strings
    }

    function parseGitignore(content) {
        if (!content) return [];
        return content
            .split('\n')
            .map(line => line.trim())
            .filter(line => line && !line.startsWith('#'));
    }

    function shouldProcessFile(relativePath, fileSize, fileName) {
        // 1. Check Always Ignore Rules (these take highest priority)
        for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) {
            if (matchesSimplePattern(relativePath, pattern, isDir)) {
                // console.log(`Ignoring ${relativePath} due to ALWAYS_IGNORE rule: ${pattern}`);
                return false; // Ignore
            }
        }

        // 2. Check file size (using current slider value)
        if (fileSize > currentMaxSizeBytes) {
            // console.log(`Ignoring ${relativePath} due to size > ${formatSize(currentMaxSizeBytes)}`);
            return false; // Ignore
        }

        // 3. Check for likely binary extension
        if (isLikelyBinaryByExtension(fileName)) {
            // console.log(`Ignoring ${relativePath} due to binary extension`);
            return false; // Ignore
        }

        // 4. Apply User's Include/Exclude Filter
        const matchesUserPattern = userFilterPatterns.length > 0 &&
                                   userFilterPatterns.some(p => matchesSimplePattern(relativePath, p));

        if (currentFilterMode === 'Include') {
            // If Include mode is active AND there are patterns, the file MUST match one
            if (userFilterPatterns.length > 0 && !matchesUserPattern) {
                // console.log(`Ignoring ${relativePath} - does not match INCLUDE patterns`);
                return false; // Ignore
            }
            // If Include mode is active but no patterns are given, process everything (subject to other rules)
            // If it matches an include pattern, proceed to gitignore check.
        } else { // Exclude mode
            // If Exclude mode is active AND the file matches a pattern, ignore it
            if (matchesUserPattern) {
                // console.log(`Ignoring ${relativePath} - matches EXCLUDE pattern`);
                return false; // Ignore
            }
            // If it doesn't match an exclude pattern, proceed to gitignore check.
        }

        // 5. Check .gitignore rules (only if not already ignored)
        // Special case: Don't let .gitignore ignore the root .gitignore file itself
        if (relativePath === '.gitignore') {
             return true; // Always process the root .gitignore if found earlier
        }
        for (const rule of gitignoreRules) {
            if (matchesSimplePattern(relativePath, rule)) {
                // console.log(`Ignoring ${relativePath} due to .gitignore rule: ${rule}`);
                return false; // Ignore
            }
        }

        // 6. If not ignored by any rule, process it
        return true;
    }

    function isLikelyBinaryByExtension(filename) {
        const lowerFilename = filename.toLowerCase();
        for (const ext of BINARY_EXTENSIONS) {
            if (lowerFilename.endsWith(ext)) {
                return true;
            }
        }
        return false;
    }

    function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) {
        // path = "src/file.js" or "config/settings.json" or "image.png"
        // pattern = "node_modules/" or "*.log" or "config/" or ".env" or "test*"

        if (isDirPattern) {
            // Directory match: Check if path starts with the pattern or is exactly the pattern minus slash
            const dirPattern = pattern.endsWith('/') ? pattern.slice(0, -1) : pattern;
            return path === dirPattern || path.startsWith(dirPattern + '/');
        } else if (pattern.startsWith('*') && !pattern.includes('/')) {
             // Wildcard at start, simple filename: *.log matches file.log, src/file.log
            return path.endsWith(pattern.slice(1));
        } else if (pattern.endsWith('*') && !pattern.includes('/')) {
             // Wildcard at end, simple filename: test* matches test.js, src/test_file.py
             const filename = path.split('/').pop();
             return filename.startsWith(pattern.slice(0, -1));
        } else if (!pattern.includes('*') && !pattern.includes('/')) {
             // Exact filename match anywhere: '.env' matches '.env', 'src/.env'
             return path.split('/').pop() === pattern;
        } else {
             // More specific path or pattern with slashes (treat as prefix or exact match)
             // Handles: 'src/config.js', 'src/', 'data/*.csv' (basic)
             if (pattern.endsWith('*')) {
                 // e.g. 'src/data*' should match 'src/data.csv', 'src/database/file'
                 const prefix = pattern.slice(0, -1);
                 return path.startsWith(prefix);
             } else {
                // Exact match 'src/file.js' or prefix match 'src/'
                return path === pattern || path.startsWith(pattern + '/');
             }
        }
         // Note: This simplified matching doesn't cover many gitignore complexities like '**'
         // or negations ('!').
    }

    function formatSize(bytes) {
        if (bytes === 0) return '0 KB';
        const kb = bytes / 1024;
        if (kb < 1024) {
            return `${kb.toFixed(0)} KB`;
        } else {
            return `${(kb / 1024).toFixed(1)} MB`;
        }
    }

    function copyOutputToClipboard() {
        if (!outputArea.value) return;
        navigator.clipboard.writeText(outputArea.value)
            .then(() => {
                const originalStatus = statusDisplay.textContent; // Store original status
                statusDisplay.textContent = 'Output copied to clipboard!';
                const originalText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    statusDisplay.textContent = originalStatus; // Restore original status
                }, 2500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                statusDisplay.textContent = 'Failed to copy. See console for error.';
                alert('Could not copy text. You might need to grant clipboard permissions or copy manually.');
            });
    }

    // --- Initialize ---
    // Set initial slider display value correctly
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);

});