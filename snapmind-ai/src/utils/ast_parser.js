import * as acorn from 'acorn';
import * as walk from 'acorn-walk';

/**
 * Extracts meaningful code blocks (functions, classes) from a JS source string.
 * @param {string} source - The JS source code
 * @param {string} filePath - Source file path for metadata
 * @returns {Array} - Array of code block objects { content, type, name, start, end }
 */
export function extractCodeBlocks(source, filePath) {
  const blocks = [];
  try {
    const ast = acorn.parse(source, {
      ecmaVersion: 'latest',
      sourceType: 'module',
      allowReserved: true,
      allowReturnOutsideFunction: true,
      allowImportExportEverywhere: true,
      allowAwaitOutsideFunction: true,
      allowHashBang: true
    });

    walk.simple(ast, {
      FunctionDeclaration(node) {
        blocks.push({
          name: node.id.name,
          type: 'FunctionDeclaration',
          content: source.substring(node.start, node.end),
          loc: { start: node.start, end: node.end }
        });
      },
      ClassDeclaration(node) {
        blocks.push({
          name: node.id.name,
          type: 'ClassDeclaration',
          content: source.substring(node.start, node.end),
          loc: { start: node.start, end: node.end }
        });
      },
      VariableDeclaration(node) {
        // Detect arrow functions assigned to variables
        node.declarations.forEach(decl => {
          if (decl.init && (decl.init.type === 'ArrowFunctionExpression' || decl.init.type === 'FunctionExpression')) {
             blocks.push({
               name: decl.id.name,
               type: 'FunctionExpression',
               content: source.substring(node.start, node.end),
               loc: { start: node.start, end: node.end }
             });
          }
        });
      },
      ExportNamedDeclaration(node) {
        if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration') {
            blocks.push({
              name: node.declaration.id.name,
              type: 'ExportedFunction',
              content: source.substring(node.start, node.end),
              loc: { start: node.start, end: node.end }
            });
          }
          if (node.declaration.type === 'ClassDeclaration') {
             blocks.push({
               name: node.declaration.id.name,
               type: 'ExportedClass',
               content: source.substring(node.start, node.end),
               loc: { start: node.start, end: node.end }
             });
          }
        }
      }
    });

    return blocks;
  } catch (e) {
    // If parsing fails (e.g. not JS or invalid syntax), return empty to fallback to text splitting
    return [];
  }
}
