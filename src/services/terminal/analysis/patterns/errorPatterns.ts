export const ERROR_PATTERNS = [
  {
    pattern: /command not found/i,
    type: 'COMMAND_NOT_FOUND'
  },
  {
    pattern: /No such file or directory/i,
    type: 'NO_SUCH_FILE'
  },
  {
    pattern: /Permission denied/i,
    type: 'PERMISSION_DENIED'
  },
  {
    pattern: /syntax error/i,
    type: 'SYNTAX_ERROR'
  },
  {
    pattern: /invalid option|invalid argument/i,
    type: 'INVALID_ARGUMENT'
  },
  {
    pattern: /not a directory/i,
    type: 'NOT_A_DIRECTORY'
  },
  {
    pattern: /is a directory/i,
    type: 'IS_A_DIRECTORY'
  }
]; 