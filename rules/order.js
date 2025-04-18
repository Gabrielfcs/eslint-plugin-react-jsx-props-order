/**
 * @fileoverview ESLint plugin that sorts JSX props by type and length with React reserved words at the top
 * @author Gabriel Felipe Cegatta dos Santos
 */
"use strict";

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Sort JSX props by type and length, with React reserved words at the top",
    },
    fixable: "code",
    schema: [{
      type: "object",
      properties: {
        reactPropsFirst: {
          type: "boolean",
          default: true
        },
        reactPropsList: {
          type: "array",
          items: {
            type: "string"
          },
          default: [
            "key", "ref", "dangerouslySetInnerHTML",
          ]
        }
      },
      additionalProperties: false
    }]
  },
  create: function (context) {
    // Get source code and options
    const sourceCode = context.sourceCode || context.getSourceCode();
    const options = context.options[0] || {};

    // React reserved words/important props that should be at the top
    const reactPropsList = options.reactPropsList || [
      "key", "ref", "dangerouslySetInnerHTML", "children",
      "value", "defaultValue", "checked", "defaultChecked",
      "className", "style", "id", "name"
    ];

    const shouldPrioritizeReactProps = options.reactPropsFirst !== false;

    // Prop categories (enum)
    const PROP_CATEGORIES = {
      REACT_RESERVED: -1,
      SHORTHAND: 0,
      STRING: 1,
      VARIABLE: 2,
      FUNCTION: 3,
      MULTILINE_OBJECT: 4,
      MULTILINE_FUNCTION: 5,
    };

    // Regex patterns for type identification
    const PATTERNS = {
      FUNCTION: /Handler$|Callback$|^on[A-Z]|^handle[A-Z]|^toggle[A-Z]/,
      OBJECT: /Config$|Options$|Props$|Style$|Data$|^obj|^data/
    };

    // Helper functions for type checking
    function isFunction(expr) {
      return expr && (
        expr.type === "ArrowFunctionExpression" ||
        expr.type === "FunctionExpression" ||
        (expr.type === "Identifier" && PATTERNS.FUNCTION.test(expr.name))
      );
    }

    function isObject(expr) {
      return expr && (
        expr.type === "ObjectExpression" ||
        (expr.type === "Identifier" && PATTERNS.OBJECT.test(expr.name))
      );
    }

    // Determine prop category safely with better type identification
    function getPropCategory(prop) {
      const propName = prop.name.name;

      // Check if it's a React prop that should have priority
      if (shouldPrioritizeReactProps && reactPropsList.includes(propName)) {
        return PROP_CATEGORIES.REACT_RESERVED;
      }

      // Shorthand (no value)
      if (prop.value === null) {
        return PROP_CATEGORIES.SHORTHAND;
      }

      const propValueText = sourceCode.getText(prop.value);
      const isMultiline = propValueText.includes('\n');

      // Analysis for multiline props
      if (isMultiline) {
        if (prop.value.type === "JSXExpressionContainer") {
          const expression = prop.value.expression;

          // Multiline functions
          if (isFunction(expression)) {
            return PROP_CATEGORIES.MULTILINE_FUNCTION;
          }
          // Multiline objects
          else if (isObject(expression)) {
            return PROP_CATEGORIES.MULTILINE_OBJECT;
          }
        }

        // If prop name suggests it's a function
        if (PATTERNS.FUNCTION.test(propName)) {
          return PROP_CATEGORIES.MULTILINE_FUNCTION;
        }

        // If prop name suggests it's an object
        if (PATTERNS.OBJECT.test(propName)) {
          return PROP_CATEGORIES.MULTILINE_OBJECT;
        }

        // Default for multiline
        return PROP_CATEGORIES.MULTILINE_OBJECT;
      }

      // Strings
      if (
        prop.value.type === "Literal" ||
        (prop.value.type === "JSXExpressionContainer" &&
          prop.value.expression && prop.value.expression.type === "Literal")
      ) {
        return PROP_CATEGORIES.STRING;
      }

      // For single line props in JSXExpressionContainer
      if (prop.value.type === "JSXExpressionContainer") {
        const expression = prop.value.expression;

        // Inline functions
        if (isFunction(expression)) {
          return PROP_CATEGORIES.FUNCTION;
        }

        // If prop name suggests a function
        if (PATTERNS.FUNCTION.test(propName)) {
          return PROP_CATEGORIES.FUNCTION;
        }

        // If prop name suggests it's not a function
        if (PATTERNS.OBJECT.test(propName)) {
          return PROP_CATEGORIES.VARIABLE;
        }
      }

      // Default: variables
      return PROP_CATEGORIES.VARIABLE;
    }

    // Comparator for prop sorting
    function comparePropOrder(propA, propB) {
      const categoryA = getPropCategory(propA);
      const categoryB = getPropCategory(propB);

      // Sort by category first
      if (categoryA !== categoryB) {
        return categoryA - categoryB;
      }

      const nameA = propA.name.name;
      const nameB = propB.name.name;

      // For React props, sort according to the order in the list
      if (categoryA === PROP_CATEGORIES.REACT_RESERVED) {
        const indexA = reactPropsList.indexOf(nameA);
        const indexB = reactPropsList.indexOf(nameB);

        // If both are in the list, use the list order
        if (indexA !== -1 && indexB !== -1) {
          return indexA - indexB;
        }

        // If only one is in the list, that one comes first
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
      }

      // Within the same category, sort by key length
      if (nameA.length !== nameB.length) {
        return nameA.length - nameB.length;
      }

      // In case of same length, sort alphabetically
      if (nameA !== nameB) {
        return nameA.localeCompare(nameB);
      }

      // For multiline, also consider the length of the value
      if (
        categoryA === PROP_CATEGORIES.MULTILINE_OBJECT ||
        categoryA === PROP_CATEGORIES.MULTILINE_FUNCTION
      ) {
        const textA = sourceCode.getText(propA.value);
        const textB = sourceCode.getText(propB.value);
        const linesA = textA.split("\n").length;
        const linesB = textB.split("\n").length;

        return linesA - linesB;
      }

      return 0;
    }

    // Create fix for unordered props
    function createFix(node, attributes, sortedAttributes) {
      return fixer => {
        // Get component name
        const tagName = sourceCode.getText(node.name);

        // Extract indentation
        const nodeText = sourceCode.getText(node);
        const indentMatch = nodeText.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';
        const attrIndent = indent + '  ';

        // Build the element with sorted attributes
        const sortedAttributesText = sortedAttributes
          .map(attr => sourceCode.getText(attr))
          .join('\n' + attrIndent);

        // Build the final result
        let fixedText = `<${tagName}\n${attrIndent}${sortedAttributesText}${node.selfClosing ? ' />' : '>'}`;

        // Apply the fix by replacing the entire opening element
        return fixer.replaceText(node, fixedText);
      };
    }

    return {
      JSXOpeningElement(node) {
        // Skip if no attributes or just one attribute
        if (!node.attributes || node.attributes.length <= 1) return;

        // Filter only JSX attributes
        const attributes = node.attributes.filter(attr => attr.type === "JSXAttribute");
        if (attributes.length <= 1) return;

        // Create a sorted copy
        const sortedAttributes = [...attributes].sort(comparePropOrder);

        // Check if already sorted
        let isSorted = true;
        for (let i = 0; i < attributes.length; i++) {
          if (attributes[i] !== sortedAttributes[i]) {
            isSorted = false;
            break;
          }
        }

        if (!isSorted) {
          context.report({
            node,
            message: "JSX props should be sorted by type and length",
            fix: createFix(node, attributes, sortedAttributes)
          });
        }
      }
    };
  }
};