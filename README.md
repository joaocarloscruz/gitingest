# Codebase Ingest Tool ⚙️

A web-based tool to fetch, filter, and view the structure and content of codebases from local folders or public GitHub repositories. Useful for preparing code context for analysis or large language models (LLMs).

## Features

*   **Dual Input:** Supports selecting a local directory or fetching a public GitHub repository via URL.
*   **Filtering:**
    *   Applies common `.gitignore` rules (from the root of the repository/folder).
    *   Allows custom `include` or `exclude` patterns (simple glob-like matching).
    *   Filters based on maximum file size.
    *   Automatically attempts to exclude common binary file extensions.
*   **Interactive View:**
    *   Displays the processed file structure in a navigable tree.
    *   Shows the content of selected text files in a preview pane.
*   **Download:** Creates and downloads a `.zip` archive containing all the processed files, preserving the directory structure.
*   **Privacy:** Local folder processing is done entirely in the browser. URL fetching uses public GitHub APIs; no data is stored externally by this tool itself.

## How to Use

1.  Open `index.html` in your web browser.
2.  Select the input source: "Local Folder" or "Git Repository URL".
3.  **For Local Folder:** Click "Select Code Folder" and choose the directory containing your code.
4.  **For Git URL:** Enter the full URL of a public GitHub repository (e.g., `https://github.com/owner/repository`) and click "Fetch Repository".
5.  **Configure Filters (Optional):**
    *   Set the filter action (Exclude/Include) and enter comma-separated patterns (e.g., `*.log, dist/, test*`).
    *   Adjust the "Max File Size" slider.
6.  The tool will process the files based on the filters. Status messages will indicate progress.
7.  Once processing is complete:
    *   The file structure will appear in the "Project Structure" panel.
    *   Click on a file name (📄) in the tree to view its content in the "File Preview" panel.
    *   Click "Copy Content" to copy the text from the preview pane.
    *   Click "Download Project (.zip)" to save the processed files and structure as a zip archive.

## Limitations

*   `.gitignore` and pattern matching are simplified and may not cover all complex glob rules perfectly. Negation rules (`!`) in `.gitignore` are currently ignored.
*   URL fetching currently only supports **public GitHub repositories**.
*   GitHub API has rate limits which might be encountered with very large repositories or frequent use.
*   GitHub API limits fetching file content directly to 1MB per file. Larger files will be skipped during URL fetching.
*   Binary file detection is primarily based on file extension and a basic check for null bytes; some binary files might slip through, or some text files might be misidentified.
