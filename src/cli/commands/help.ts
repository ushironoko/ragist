export function showHelp(): void {
  console.log(`
Gistdex - RAG Search System for Gist and GitHub Repositories

Usage: gistdex <command> [options]

Commands:
  index    Index content into the database
    Options:
      --provider <name>  Vector DB provider (default: sqlite)
      --db <path>        Database file path (for SQLite)
      --text <text>      Index plain text
      --file <path>      Index a single local file (restricted to current directory and subdirectories)
      --files <patterns> Index multiple files using glob patterns (comma-separated)
      --gist <url>       Index a GitHub Gist (only gist.github.com URLs allowed)
      --github <url>     Index a GitHub repository (only github.com URLs allowed)
      --title <title>    Title for the indexed content
      --url <url>        URL for the indexed content
      --chunk-size <n>   Chunk size (default: 1000)
      --chunk-overlap <n> Chunk overlap (default: 200)
      --branch <branch>  GitHub branch (default: main)
      --paths <paths>    GitHub paths to index (comma-separated)
      
  query    Search indexed content
    Options:
      --provider <name>    Vector DB provider (default: sqlite)
      --db <path>          Database file path (for SQLite)
      -k, --top-k <n>      Number of results (default: 5)
      -t, --type <type>    Source type filter (gist, github, file, text)
      -y, --hybrid         Use hybrid search
      -n, --no-rerank      Disable re-ranking
      -f, --full           Show full original source content
      <query>              Search query
      
  list     List indexed items
    Options:
      --provider <name>  Vector DB provider (default: sqlite)
      --db <path>        Database file path (for SQLite)
      --stats            Show statistics only
      
  info     Show database adapter information
    Options:
      --provider <name>  Vector DB provider (default: sqlite)
      
  version  Show CLI version
  
  help     Show this help message

Special Commands:
  init, --init   Initialize a new Gistdex project with .env and config files
                 Creates an interactive setup wizard for configuration

Environment Variables:
  VECTOR_DB_PROVIDER     Default vector DB provider
  VECTOR_DB_CONFIG       JSON configuration for the provider
  SQLITE_DB_PATH         SQLite database path
  EMBEDDING_DIMENSION    Embedding dimension (default: 768)

Supported Providers:
  - sqlite (built-in)
  - More providers can be added via plugins

Security:
  - File indexing is restricted to the current working directory and allowed subdirectories
  - External URLs are limited to GitHub and Gist domains only (github.com, gist.github.com)
  - Path traversal attacks (../) are prevented
  - Symbolic links pointing outside allowed directories are blocked

Examples:
  # Index a Gist
  gistdex index --gist https://gist.github.com/user/abc123
  
  # Index a single file
  gistdex index --provider sqlite --db mydata.db --file ./document.md
  
  # Index multiple files with glob patterns
  gistdex index --files "data/*.md"
  gistdex index --files "**/*.txt,docs/*.md"
  
  # Search indexed content
  gistdex query "vector search implementation"
  
  # Use environment configuration
  export VECTOR_DB_PROVIDER=sqlite
  export SQLITE_DB_PATH=./my-database.db
  gistdex query "embeddings"
`);
}
