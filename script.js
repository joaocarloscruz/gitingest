document.addEventListener('DOMContentLoaded', () => {
    const folderInput = document.getElementById('folderInput');
    const statusDisplay = document.getElementById('status');
    const outputArea = document.getElementById('output');
    const copyButton = document.getElementById('copyButton');
    const filterModeSelect = document.getElementById('filterMode');
    const filterPatternsInput = document.getElementById('filterPatterns');
    const maxSizeSlider = document.getElementById('maxSizeSlider');
    const maxSizeValueDisplay = document.getElementById('maxSizeValue');

    // --- Configuration ---
    let currentMaxSizeBytes = parseInt(maxSizeSlider.value) * 1024;

    const BINARY_EXTENSIONS = new Set([
        // Images
        '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.ico', '.webp',
        // Documents
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
        // Archives
        '.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.iso', '.dmg',
        // Executables/Binaries
        '.exe', '.dll', '.so', '.dylib', '.app', '.bin', '.msi',
        // Audio/Video
        '.mp3', '.wav', '.ogg', '.flac', '.aac', '.mp4', '.avi', '.mov', '.webm', '.mkv', '.wmv',
        // Java/Python Bytecode
        '.class', '.jar', '.pyc', '.pyd',
        // Lock files & Build artifacts
        '.lock', '.lockb', '.package-lock.json', // Be careful with package-lock, maybe keep it?
        // Assets/Fonts
        '.svg', '.woff', '.woff2', '.ttf', '.otf', '.eot',
        // Database files
        '.sqlite', '.db', '.mdb',
        // Others
        '.DS_Store', 'Thumbs.db'
    ]);

    // Directories/files to always ignore (these override include/exclude and gitignore)
    // Added more common ones
    const ALWAYS_IGNORE_PATTERNS = [
        '.git/',
        '.svn/',
        '.hg/',
        'node_modules/',
        'bower_components/',
        'vendor/', // PHP Composer, etc.
        'dist/',
        'build/',
        'out/',
        'target/', // Java Maven/Gradle
        'coverage/',
        '__pycache__/',
        '*.pyc',
        '.DS_Store',
        'Thumbs.db',
        '.env', // Often contains secrets
        '.idea/', // JetBrains IDE
        '.vscode/', // VS Code workspace settings (can sometimes contain secrets/paths)
        '*.log', // Log files
        '*.tmp',
        '*.temp'
    ].map(p => ({ pattern: p, isDir: p.endsWith('/') })); // Pre-process

    let gitignoreRules = [];
    let userFilterPatterns = [];
    let currentFilterMode = filterModeSelect.value;

    // --- Event Listeners ---
    folderInput.addEventListener('change', handleFolderSelect);
    copyButton.addEventListener('click', copyOutputToClipboard);

    maxSizeSlider.addEventListener('input', () => {
        const kbValue = parseInt(maxSizeSlider.value);
        currentMaxSizeBytes = kbValue * 1024;
        maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
        updateSliderBackground();
        // Note: Does not re-filter automatically after files are loaded.
    });

    filterModeSelect.addEventListener('change', () => {
        currentFilterMode = filterModeSelect.value;
        // Note: Does not re-filter automatically.
    });

    // --- Initial Setup ---
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
    updateSliderBackground(); // Set initial background

    function updateSliderBackground() {
        const percentage = (parseInt(maxSizeSlider.value) / parseInt(maxSizeSlider.max)) * 100;
        maxSizeSlider.style.setProperty('--value-percent', `${percentage}%`);
    }


    // --- Core Logic ---

    async function handleFolderSelect(event) {
        const files = event.target.files;
        if (!files || files.length === 0) {
            statusDisplay.textContent = 'No folder selected or folder is empty.';
            outputArea.value = '';
            copyButton.disabled = true;
            return;
        }

        statusDisplay.textContent = `⏳ Preparing... Reading filters...`;
        outputArea.value = 'Processing... Please wait.\n';
        copyButton.disabled = true;
        gitignoreRules = []; // Reset rules
        userFilterPatterns = parseUserPatterns(filterPatternsInput.value);
        currentFilterMode = filterModeSelect.value;

        const sortedFiles = Array.from(files).sort((a, b) => {
            // Prioritize root .gitignore
            if (a.webkitRelativePath.split('/').length === 2 && a.name === '.gitignore') return -1;
            if (b.webkitRelativePath.split('/').length === 2 && b.name === '.gitignore') return 1;
            // Otherwise, sort alphabetically by path
            return a.webkitRelativePath.localeCompare(b.webkitRelativePath);
        });

        const rootGitignoreFile = sortedFiles.find(f => f.webkitRelativePath.split('/').length === 2 && f.name === '.gitignore');

        if (rootGitignoreFile) {
            try {
                statusDisplay.textContent = '⏳ Reading root .gitignore...';
                // Allow reading .gitignore even if large, but use a reasonable limit (e.g., 1MB) just in case
                const gitignoreContent = await readFileContent(rootGitignoreFile, 1 * 1024 * 1024);
                gitignoreRules = parseGitignore(gitignoreContent);
                 statusDisplay.textContent = `ℹ️ Found ${gitignoreRules.length} rules in .gitignore. Processing files...`;
            } catch (error) {
                console.error("Error reading .gitignore:", error);
                statusDisplay.textContent = '⚠️ Could not read root .gitignore, proceeding without it. Processing files...';
            }
        } else {
             statusDisplay.textContent = 'ℹ️ No root .gitignore found. Processing files...';
        }
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay for UI update


        let combinedOutput = '';
        let processedFileCount = 0;
        let ignoredFileCount = 0;
        const totalFiles = sortedFiles.length;
        const fileProcessingPromises = [];

        statusDisplay.textContent = `🔎 Analyzing ${totalFiles} items...`;
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow UI update

        for (let i = 0; i < sortedFiles.length; i++) {
            const file = sortedFiles[i];
            // Handle cases where webkitRelativePath might be missing or empty (though unlikely for directory selections)
            if (!file.webkitRelativePath) {
                ignoredFileCount++;
                continue;
            }
            const filePath = file.webkitRelativePath;
            const firstSlashIndex = filePath.indexOf('/');
             // Ensure relativePathInRepo calculation is safe
            const relativePathInRepo = firstSlashIndex !== -1 ? filePath.substring(firstSlashIndex + 1) : filePath;

            if (!shouldProcessFile(relativePathInRepo, file.size, file.name, file.type)) {
                ignoredFileCount++;
                continue;
            }

            fileProcessingPromises.push(
                readFileContent(file)
                    .then(content => ({ path: relativePathInRepo, content: content }))
                    .catch(error => {
                        console.warn(`Skipping file ${relativePathInRepo}: ${error.message}`);
                        // Don't increment ignoredFileCount here, it was already done if shouldProcessFile failed,
                        // or it will be implicitly ignored by not being added to output.
                        // We need a way to track files that *failed* reading vs. filtered out. Let's add a separate counter or refine.
                        // For now, just return null.
                        return null;
                    })
            );

            if (i % 150 === 0 || i === totalFiles - 1) {
                 statusDisplay.textContent = `🔎 Analyzing item ${i + 1}/${totalFiles}... (Filtered so far: ${ignoredFileCount})`;
                 await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const filesToReadCount = fileProcessingPromises.length;
        statusDisplay.textContent = `📚 Reading ${filesToReadCount} filtered files...`;
        await new Promise(resolve => setTimeout(resolve, 0));

        const results = await processPromisesBatch(fileProcessingPromises, 15, (done, total) => {
            statusDisplay.textContent = `📚 Reading file ${done}/${total}...`;
        });

        let readErrorCount = 0;
        results.forEach(result => {
            if (result && result.content !== null) {
                combinedOutput += `--- FILENAME: ${result.path} ---\n`;
                combinedOutput += result.content;
                combinedOutput += '\n\n';
                processedFileCount++;
            } else if (result === null) {
                // This means readFileContent failed (e.g., detected binary during read)
                readErrorCount++;
            }
        });

        // Recalculate ignored count more accurately
        ignoredFileCount = totalFiles - processedFileCount - readErrorCount;

        outputArea.value = combinedOutput;
        statusDisplay.textContent = `✅ Done. Processed ${processedFileCount} files. Filtered/Ignored ${ignoredFileCount} items. Read errors: ${readErrorCount}. Total items: ${totalFiles}.`;
        copyButton.disabled = combinedOutput.length === 0;

        folderInput.value = null; // Allow selecting the same folder again
    }

    async function processPromisesBatch(promises, batchSize, progressCallback) {
        let results = [];
        let index = 0;
        while (index < promises.length) {
            const batch = promises.slice(index, index + batchSize);
            const batchResults = await Promise.all(batch);
            results = results.concat(batchResults);
            index += batchSize;
            if (progressCallback) {
                // Use Math.min to avoid showing index > total if batch size doesn't divide evenly
                progressCallback(Math.min(index, promises.length), promises.length);
            }
            await new Promise(resolve => setTimeout(resolve, 0)); // Yield to main thread
        }
        return results;
    }

    function readFileContent(file, sizeLimitOverride = null) {
        return new Promise((resolve, reject) => {
            const sizeLimit = sizeLimitOverride !== null ? sizeLimitOverride : currentMaxSizeBytes;
            if (file.size > sizeLimit) {
                // Use Kibi/Mebi for display as it matches slider unit base
                const displaySizeLimit = formatSize(sizeLimit);
                const fileDisplaySize = formatSize(file.size);
                return reject(new Error(`File size (${fileDisplaySize}) exceeds limit of ${displaySizeLimit}`));
            }

            // Simple check for common non-text mime types first (optional enhancement)
            // if (file.type && !file.type.startsWith('text/') && file.type !== 'application/json' && file.type !== 'application/xml' && file.type !== 'application/javascript') {
            //     // Be cautious, mime types aren't always reliable
            //      // console.log(`Skipping based on likely non-text MIME type: ${file.type} for ${file.name}`);
            //      // return reject(new Error(`Likely non-text MIME type: ${file.type}`));
            // }

            const reader = new FileReader();
            reader.onload = (event) => {
                const text = event.target.result;
                 // Check for null bytes more robustly - common in binary files
                if (text && text.indexOf('\u0000') !== -1) {
                    reject(new Error(`Detected null byte, likely a binary file: ${file.name}`));
                } else {
                    resolve(text);
                }
            };
            reader.onerror = (event) => {
                reject(new Error(`Error reading file ${file.name}: ${reader.error}`));
            };
            // Specify encoding if needed, though default UTF-8 is usually fine
            reader.readAsText(file /*, 'UTF-8'*/);
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
            // Filter out empty lines and comments
            .filter(line => line && !line.startsWith('#'))
            // Basic handling for negation, though matchesSimplePattern doesn't use it yet
            // .map(line => ({ pattern: line, negated: line.startsWith('!') }))
            // .map(rule => rule.negated ? { ...rule, pattern: rule.pattern.substring(1) } : rule);
             // Simple version for now:
            .filter(line => !line.startsWith('!')); // Ignore negation rules for now
    }

    function shouldProcessFile(relativePath, fileSize, fileName, fileType) {
        // 0. Handle empty relativePath (edge case)
        if (!relativePath) return false;

        // 1. Check Always Ignore Rules (highest priority)
        for (const { pattern, isDir } of ALWAYS_IGNORE_PATTERNS) {
            if (matchesSimplePattern(relativePath, pattern, isDir)) {
                // console.log(`Ignoring ${relativePath} due to ALWAYS_IGNORE rule: ${pattern}`);
                return false;
            }
        }

        // 2. Check file size (using current slider value)
        if (fileSize > currentMaxSizeBytes) {
            // console.log(`Ignoring ${relativePath} due to size > ${formatSize(currentMaxSizeBytes)}`);
            return false;
        }

        // 3. Check for likely binary extension (refined list)
        if (isLikelyBinaryByExtension(fileName)) {
            // console.log(`Ignoring ${relativePath} due to binary extension`);
            return false;
        }

        // 4. Apply User's Include/Exclude Filter
        const matchesUserPattern = userFilterPatterns.length > 0 &&
                                   userFilterPatterns.some(p => matchesSimplePattern(relativePath, p));

        if (currentFilterMode === 'Include') {
            // If Include mode and patterns exist, file *must* match one.
            if (userFilterPatterns.length > 0 && !matchesUserPattern) {
                // console.log(`Ignoring ${relativePath} - does not match INCLUDE patterns`);
                return false;
            }
            // If Include mode but no patterns, process everything (subject to other rules).
            // If matches include pattern, proceed to gitignore.
        } else { // Exclude mode (default)
            // If Exclude mode and file matches a pattern, ignore it.
            if (matchesUserPattern) {
                // console.log(`Ignoring ${relativePath} - matches EXCLUDE pattern`);
                return false;
            }
            // If it doesn't match an exclude pattern, proceed to gitignore.
        }

        // 5. Check .gitignore rules (only if not already ignored)
        // Don't let .gitignore ignore the root .gitignore itself if we are processing it
        if (relativePath === '.gitignore') {
             // This check might be redundant if rootGitignoreFile handling is robust, but safe to keep.
             // It only matters if .gitignore somehow listed itself.
             return true;
        }
        for (const rule of gitignoreRules) {
            if (matchesSimplePattern(relativePath, rule)) {
                // console.log(`Ignoring ${relativePath} due to .gitignore rule: ${rule}`);
                return false;
            }
        }

        // 6. If not ignored by any rule, process it
        // console.log(`Processing: ${relativePath}`);
        return true;
    }

    function isLikelyBinaryByExtension(filename) {
        const lowerFilename = filename.toLowerCase();
        const extension = '.' + lowerFilename.split('.').pop(); // Get the last extension part
        return BINARY_EXTENSIONS.has(extension);
    }

    // Simplified pattern matching (basic globstar, directory, exact, extension)
    function matchesSimplePattern(path, pattern, isDirPattern = pattern.endsWith('/')) {
        // Normalize path separators for cross-platform consistency (within the function)
        const normalizedPath = path.replace(/\\/g, '/');

        if (pattern.startsWith('!')) {
             // Basic negation handling - ignore these rules for now in this simple matcher
             // In a real implementation, this would require tracking matches and negations.
             return false;
        }

        if (isDirPattern) {
            // Directory match: 'foo/' should match 'foo/bar' and 'foo' (as a directory entry)
            const dirPattern = pattern.slice(0, -1);
            return normalizedPath === dirPattern || normalizedPath.startsWith(dirPattern + '/');
        } else if (pattern.startsWith('**/')) {
             // Globstar directory prefix: Matches anywhere in the path
             return normalizedPath.includes('/' + pattern.substring(3)) || normalizedPath.endsWith(pattern.substring(3));
        } else if (pattern.startsWith('*') && !pattern.includes('/')) {
             // Wildcard extension match: '*.js' matches 'file.js', 'src/file.js'
            return normalizedPath.endsWith(pattern.slice(1));
        } else if (pattern.endsWith('*') && !pattern.includes('/')) {
             // Wildcard prefix match: 'test*' matches 'test.js', 'src/test_runner.py' (matches filename part)
             const filename = normalizedPath.split('/').pop();
             return filename.startsWith(pattern.slice(0, -1));
        } else if (!pattern.includes('*') && !pattern.includes('/')) {
             // Exact filename match anywhere: '.env' matches '.env', 'src/.env'
             return normalizedPath.split('/').pop() === pattern;
        } else if (!pattern.includes('*') && pattern.includes('/')) {
             // Exact path match or prefix match if it looks like a directory pattern wasn't used explicitly
             // Example: 'src/utils' should match 'src/utils/helper.js'
             return normalizedPath === pattern || normalizedPath.startsWith(pattern + '/');
        }
        else {
            // Basic wildcard within path segment: 'src/*.js' (simplified)
            if (pattern.includes('*') && pattern.includes('/')) {
                 // Very basic: treat '*' as a non-greedy wildcard within a segment
                 // This won't handle complex globs well.
                 const regexPattern = pattern.replace(/\*/g, '[^/]*'); // Replace * with non-slash characters
                 try {
                     const regex = new RegExp('^' + regexPattern + '$');
                     return regex.test(normalizedPath);
                 } catch (e) {
                     console.warn("Failed to create regex for pattern:", pattern, e);
                     return false; // Invalid pattern for this simple regex approach
                 }

            }
            // Fallback for patterns not covered above (e.g. complex globs, middle wildcards)
            // Treat as simple prefix match for now if contains '/'
             if (pattern.includes('/')) {
                return normalizedPath.startsWith(pattern);
             }
        }

        // Default case: if no specific rule matched, assume no match for safety
        return false;
    }


    function formatSize(bytes) {
        if (bytes < 0) bytes = 0; // Handle potential negative values if slider min changes
        if (bytes === 0) return '0 KB';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']; // GB/TB unlikely needed here but good practice

        // Use KiB/MiB which is base 1024
        if (bytes < k) return bytes + ' Bytes'; // Show bytes if < 1KB

        const i = Math.floor(Math.log(bytes) / Math.log(k));
        const size = parseFloat((bytes / Math.pow(k, i)).toFixed(i === 0 ? 0 : (i === 1 ? 0 : 1))); // 0 decimals for KB, 1 for MB+

        // Handle potential edge case where calculation results in exactly 1024 of a unit
        if (size >= k && i < sizes.length - 1) {
             return `1.0 ${sizes[i + 1]}`;
        }

        return `${size} ${sizes[i]}`;
    }


    function copyOutputToClipboard() {
        if (!outputArea.value) return;
        navigator.clipboard.writeText(outputArea.value)
            .then(() => {
                const originalStatus = statusDisplay.textContent;
                statusDisplay.textContent = '✅ Output copied to clipboard!';
                const originalButtonText = copyButton.textContent;
                copyButton.textContent = 'Copied!';
                copyButton.classList.add('copied'); // Add class for styling feedback

                setTimeout(() => {
                    copyButton.textContent = originalButtonText;
                    copyButton.classList.remove('copied');
                    // Restore status only if it hasn't been updated by another process in the meantime
                    if (statusDisplay.textContent === '✅ Output copied to clipboard!') {
                        statusDisplay.textContent = originalStatus;
                    }
                }, 2500);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                statusDisplay.textContent = '❌ Failed to copy. See console for error.';
                // Try fallback using execCommand (older browsers, less reliable, might be removed)
                try {
                    outputArea.select();
                    document.execCommand('copy');
                    statusDisplay.textContent = '✅ Copied using fallback method.';
                    // Provide visual feedback similar to navigator.clipboard
                    const originalButtonText = copyButton.textContent;
                    copyButton.textContent = 'Copied!';
                    copyButton.classList.add('copied');
                    setTimeout(() => {
                        copyButton.textContent = originalButtonText;
                        copyButton.classList.remove('copied');
                        // Restore status
                         if (statusDisplay.textContent === '✅ Copied using fallback method.') {
                            statusDisplay.textContent = `✅ Done. Processed ${processedFileCount} files...`; // Restore meaningful status
                        }
                    }, 2500);

                } catch (execErr) {
                     console.error('Fallback copy method also failed:', execErr);
                    alert('Could not copy text automatically. Please select the text and copy manually (Ctrl+C or Cmd+C).');
                     statusDisplay.textContent = '❌ Automatic copy failed. Please copy manually.';
                }
                window.getSelection().removeAllRanges(); // Deselect text after fallback attempt
            });
    }

    // --- Initialize ---
    // Call initial setup functions again just to be safe
    maxSizeValueDisplay.textContent = formatSize(currentMaxSizeBytes);
    updateSliderBackground();

});
