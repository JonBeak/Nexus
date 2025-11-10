using System;
using System.Diagnostics;
using System.Web;
using System.Windows.Forms;

namespace NexusFolderOpener
{
    /// <summary>
    /// Nexus Folder Opener - Windows GUI Application
    /// Opens network folders from web app via nexus:// protocol
    /// Runs completely invisible - no console, no UI
    /// </summary>
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            // If no arguments, exit silently
            if (args.Length == 0)
            {
                return;
            }

            try
            {
                // Get the protocol URL (e.g., "nexus://open?path=\\server\folder")
                string protocolUrl = args[0];

                // Parse the URL
                Uri uri = new Uri(protocolUrl);

                // Validate protocol
                if (uri.Scheme.ToLower() != "nexus")
                {
                    return;
                }

                // Extract the path parameter
                var query = HttpUtility.ParseQueryString(uri.Query);
                string folderPath = query["path"];

                if (string.IsNullOrEmpty(folderPath))
                {
                    return;
                }

                // Security validation: Only allow safe path patterns
                if (!IsValidPath(folderPath))
                {
                    // Invalid path - show error and exit
                    MessageBox.Show(
                        "Invalid folder path. Only UNC paths and specific local paths are allowed.\n\n" +
                        "Path: " + folderPath,
                        "Nexus Folder Opener - Security Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                // Open Windows Explorer to the folder
                Process.Start("explorer.exe", "\"" + folderPath + "\"");
            }
            catch (UriFormatException)
            {
                // Invalid URL format - exit silently
                return;
            }
            catch (Exception ex)
            {
                // Only show errors if it's something the user can fix
                // (e.g., folder doesn't exist, network unavailable)
                if (ex is System.ComponentModel.Win32Exception ||
                    ex is System.IO.DirectoryNotFoundException)
                {
                    MessageBox.Show(
                        "Unable to open folder. Please check:\n\n" +
                        "• The folder exists\n" +
                        "• You have network access\n" +
                        "• You have permission to access the folder\n\n" +
                        "Error: " + ex.Message,
                        "Nexus Folder Opener - Error",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error
                    );
                }
                // All other errors - exit silently
            }
        }

        /// <summary>
        /// Validates that the path is safe to open
        /// Only allows UNC paths, mapped drives, and specific local paths
        /// </summary>
        private static bool IsValidPath(string path)
        {
            if (string.IsNullOrWhiteSpace(path))
                return false;

            // Allow UNC paths: \\server\share\...
            if (path.StartsWith("\\\\"))
                return true;

            // Allow mapped drives: Z:\...
            if (path.Length >= 3 &&
                char.IsLetter(path[0]) &&
                path[1] == ':' &&
                path[2] == '\\')
                return true;

            // Optionally: Add specific allowed local paths
            // Uncomment and customize as needed:
            // if (path.StartsWith(@"C:\Orders\", StringComparison.OrdinalIgnoreCase))
            //     return true;
            // if (path.StartsWith(@"C:\Jobs\", StringComparison.OrdinalIgnoreCase))
            //     return true;

            // Path doesn't match any allowed pattern
            return false;
        }
    }
}
