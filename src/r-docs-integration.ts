import { exec } from 'child_process';
import { promisify } from 'util';
import { logger } from './logger.js';

const execAsync = promisify(exec);

// Interface for R doc arguments
export interface RDocArgs {
  package: string;
  symbol?: string;
  projectPath?: string;
}

// Type check function for R doc arguments
export const isRDocArgs = (args: unknown): args is RDocArgs => {
  return (
    typeof args === "object" &&
    args !== null &&
    typeof (args as RDocArgs).package === "string" &&
    (typeof (args as RDocArgs).symbol === "string" ||
      (args as RDocArgs).symbol === undefined) &&
    (typeof (args as RDocArgs).projectPath === "string" ||
      (args as RDocArgs).projectPath === undefined)
  );
};

// Interface for documentation result
export interface DocResult {
  description?: string;
  usage?: string;
  example?: string;
  error?: string;
  searchResults?: SearchResults;
  suggestInstall?: boolean;
}

// Interface for search results
export interface SearchResults {
  results: SearchResult[];
  totalResults: number;
  error?: string;
  suggestInstall?: boolean;
}

// Interface for search result
export interface SearchResult {
  symbol?: string;
  match: string;
  context?: string;
  score: number;
  type?: string;
}

// Class to handle R package documentation
export class RDocsHandler {
  /**
   * Check if R is installed and available
   */
  public async isRInstalled(): Promise<boolean> {
    try {
      await execAsync('which Rscript');
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if an R package is installed locally
   */
  public async isRPackageInstalled(packageName: string): Promise<boolean> {
    try {
      const command = `Rscript -e "cat(requireNamespace('${packageName}', quietly = TRUE))"`;
      const { stdout } = await execAsync(command);
      return stdout.trim() === 'TRUE';
    } catch (error) {
      return false;
    }
  }

  /**
   * Get documentation for an R package
   */
  public async describeRPackage(args: RDocArgs): Promise<DocResult> {
    const { package: packageName, symbol } = args;
    logger.info(`Getting R documentation for ${packageName}${symbol ? `::${symbol}` : ""}`);

    try {
      // Check if R is installed
      const isRInstalled = await this.isRInstalled();
      if (!isRInstalled) {
        return {
          error: "R is not installed or not in the PATH. Please install R and make sure it's available in your PATH.",
        };
      }

      // Check if package is installed
      const isPackageInstalled = await this.isRPackageInstalled(packageName);
      if (!isPackageInstalled) {
        return {
          error: `Package ${packageName} is not installed. Try installing it with 'install.packages("${packageName}")' in R.`,
          suggestInstall: true
        };
      }

      // Construct the R command to get documentation
      let rCommand: string;
      if (symbol) {
        // Get help for a specific symbol in the package - use direct help() call
        rCommand = `Rscript -e "help('${symbol}', package='${packageName}')"`;
      } else {
        // Get package overview - use direct help(package=) call
        rCommand = `Rscript -e "help(package='${packageName}')"`;
      }

      const { stdout } = await execAsync(rCommand);
      
      // Parse the R documentation output
      return this.parseRDoc(stdout, packageName, symbol);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error getting R documentation for ${packageName}:`, error);
      return {
        error: `Failed to fetch R documentation: ${errorMessage}`
      };
    }
  }

  /**
   * Get full documentation for an R package
   */
  public async getRPackageDoc(args: RDocArgs): Promise<DocResult> {
    const { package: packageName, symbol } = args;
    logger.info(`Getting full R documentation for ${packageName}${symbol ? `::${symbol}` : ""}`);

    try {
      // Check if R is installed
      const isRInstalled = await this.isRInstalled();
      if (!isRInstalled) {
        return {
          error: "R is not installed or not in the PATH. Please install R and make sure it's available in your PATH.",
        };
      }

      // Check if package is installed
      const isPackageInstalled = await this.isRPackageInstalled(packageName);
      if (!isPackageInstalled) {
        return {
          error: `Package ${packageName} is not installed. Try installing it with 'install.packages("${packageName}")' in R.`,
          suggestInstall: true
        };
      }

      let result: DocResult = {};
      
      // If a symbol is specified, get detailed documentation for that specific symbol
      if (symbol) {
        // Get the help for the specific symbol - direct help() call
        const helpCmd = `Rscript -e "help('${symbol}', package='${packageName}')"`;
        const { stdout: helpOutput } = await execAsync(helpCmd);
        
        // Parse the help output
        result = this.parseRDoc(helpOutput, packageName, symbol);
        
        // Get examples for the specific symbol using example() function
        try {
          const examplesCmd = `Rscript -e "example('${symbol}', package='${packageName}', ask=FALSE, echo=TRUE)"`;
          const { stdout: examplesOutput } = await execAsync(examplesCmd);
          if (examplesOutput && examplesOutput.trim() !== '') {
            result.example = examplesOutput;
          }
        } catch (exError) {
          // Examples might not exist or might have errors, we can continue without them
          logger.info(`No examples found for ${packageName}::${symbol}`);
        }
        
        return result;
      } 
      
      // If no symbol, get overview of the package - direct help(package=) call
      const overviewCmd = `Rscript -e "help(package='${packageName}')"`;
      const { stdout: overviewOutput } = await execAsync(overviewCmd);
      
      // Get the package description - simpler approach
      const descCmd = `Rscript -e "info <- packageDescription('${packageName}'); cat('Package: ', info\\$Package, '\\n'); cat('Version: ', info\\$Version, '\\n'); cat('Title: ', info\\$Title, '\\n'); cat('Description: ', info\\$Description, '\\n')"`;
      const { stdout: descOutput } = await execAsync(descCmd);
      
      // Get list of functions in the package - simpler approach
      const functionsCmd = `Rscript -e "library('${packageName}'); funcs <- ls('package:${packageName}'); cat('Functions exported by ${packageName}:\\n'); cat(paste('-', funcs), sep='\\n')"`;
      const { stdout: functionsOutput } = await execAsync(functionsCmd);
      
      // Combine outputs into a comprehensive documentation
      result.description = descOutput;
      result.usage = `# Package Overview\n\n${overviewOutput}\n\n# Exported Functions\n\n${functionsOutput}`;
      
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`Error getting full R documentation for ${packageName}:`, error);
      return {
        error: `Failed to fetch R documentation: ${errorMessage}`
      };
    }
  }

  /**
   * Parse R documentation output into structured format
   */
  private parseRDoc(doc: string, packageName: string, symbol?: string): DocResult {
    if (!doc || doc.includes('Documentation not found') || doc.trim() === '') {
      return {
        error: `Documentation not found for ${symbol ? `${packageName}::${symbol}` : `package ${packageName}`}`
      };
    }

    // Initialize result
    const result: DocResult = {};
    
    // R help output looks something like this:
    // mean                   package:base                    R Documentation
    // 
    // _A_r_i_t_h_m_e_t_i_c _M_e_a_n
    // 
    // _D_e_s_c_r_i_p_t_i_o_n:
    //      Generic function for the (trimmed) arithmetic mean.
    // 
    // _U_s_a_g_e:
    //      mean(x, ...)
    //      
    // ...

    // Parse output sections based on the R help format
    const lines = doc.split('\n');
    let currentSection = '';
    let sectionContent: string[] = [];
    
    // Extract title from first lines
    if (lines.length > 2) {
      result.description = lines[2].trim();
    }
    
    // Look for section headers like _D_e_s_c_r_i_p_t_i_o_n:, _U_s_a_g_e:, etc.
    for (let i = 3; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if this line is a section header
      // R section headers typically look like: _D_e_s_c_r_i_p_t_i_o_n:
      if (line.match(/^_[A-Za-z_]+:/) || line.match(/^[A-Z][a-z]+:/)) {
        // Save previous section if we were processing one
        if (currentSection && sectionContent.length > 0) {
          this.addSectionToResult(result, currentSection, sectionContent.join('\n'));
        }
        
        // Extract section name, removing formatting characters (_)
        currentSection = line.replace(/^_([A-Za-z_]+):.*/, '$1')
                            .replace(/_/g, '')
                            .replace(/^([A-Z][a-z]+):.*/, '$1');
        sectionContent = [];
      } else {
        // Add this line to the current section content
        sectionContent.push(line);
      }
    }
    
    // Don't forget to add the last section
    if (currentSection && sectionContent.length > 0) {
      this.addSectionToResult(result, currentSection, sectionContent.join('\n'));
    }
    
    // If we don't have usage but this is package overview, use the entire content
    if (!result.usage && !symbol) {
      result.usage = doc;
    }
    
    return result;
  }
  
  /**
   * Add a documentation section to the result object
   */
  private addSectionToResult(result: DocResult, section: string, content: string): void {
    // Handle common section names in R documentation
    switch (section.toLowerCase()) {
      case 'description':
        result.description = content;
        break;
      case 'usage':
        result.usage = content;
        break;
      case 'arguments':
        if (result.usage) {
          result.usage += '\n\n## Arguments\n\n' + content;
        } else {
          result.usage = '## Arguments\n\n' + content;
        }
        break;
      case 'value':
        if (result.usage) {
          result.usage += '\n\n## Return Value\n\n' + content;
        } else {
          result.usage = '## Return Value\n\n' + content;
        }
        break;
      case 'details':
        if (result.usage) {
          result.usage += '\n\n## Details\n\n' + content;
        } else {
          result.usage = '## Details\n\n' + content;
        }
        break;
      case 'examples':
        result.example = content;
        break;
      case 'references':
      case 'seealso':
      case 'author':
      case 'note':
        // Add other sections to usage
        if (result.usage) {
          result.usage += `\n\n## ${section}\n\n` + content;
        } else {
          result.usage = `## ${section}\n\n` + content;
        }
        break;
    }
  }
}