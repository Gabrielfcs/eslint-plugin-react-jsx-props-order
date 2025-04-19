/**
 * @fileoverview ESLint plugin that sorts JSX props by type and length with React reserved words at the top
 * @author Gabriel Felipe Cegatta dos Santos
 */
"use strict";

module.exports = {
  meta: {
    type: "suggestion",
    docs: {
      description: "Sort JSX props by type and length, with React reserved words at the top, preserving spread operator precedence",
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
      UNKNOWN: 6, // New category for unknown props
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
      // Handle unknown prop types safely
      if (prop.type !== "JSXAttribute" || !prop.name || typeof prop.name.name !== "string") {
        return PROP_CATEGORIES.UNKNOWN;
      }

      const propName = prop.name.name;

      // Check if it's a React prop that should have priority
      if (shouldPrioritizeReactProps && reactPropsList.includes(propName)) {
        return PROP_CATEGORIES.REACT_RESERVED;
      }

      // Shorthand (no value)
      if (prop.value === null) {
        return PROP_CATEGORIES.SHORTHAND;
      }

      try {
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
      } catch (error) {
        // If there's any error in parsing or processing, categorize as unknown
        return PROP_CATEGORIES.UNKNOWN;
      }
    }

    // Comparator for prop sorting within a group
    function compareProps(propA, propB) {
      try {
        const categoryA = getPropCategory(propA);
        const categoryB = getPropCategory(propB);

        // If either prop is unknown, preserve original order
        if (categoryA === PROP_CATEGORIES.UNKNOWN || categoryB === PROP_CATEGORIES.UNKNOWN) {
          return 0;
        }

        // Sort by category first
        if (categoryA !== categoryB) {
          return categoryA - categoryB;
        }

        // For regular JSX attributes
        if (propA.type === "JSXAttribute" && propB.type === "JSXAttribute" &&
          propA.name && propB.name && typeof propA.name.name === "string" && typeof propB.name.name === "string") {
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
            try {
              const textA = sourceCode.getText(propA.value);
              const textB = sourceCode.getText(propB.value);
              const linesA = textA.split("\n").length;
              const linesB = textB.split("\n").length;

              return linesA - linesB;
            } catch (error) {
              // If there's an error comparing multiline props, preserve original order
              return 0;
            }
          }
        }

        // In case of any issues or edge cases, maintain original order
        return 0;
      } catch (error) {
        // Safety mechanism: if comparison fails for any reason, maintain original order
        return 0;
      }
    }

    // Group attributes by their position relative to spread operators
    function groupAttributesBySpread(attributes) {
      const groups = [];
      let currentGroup = [];

      // Iterate through attributes
      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];

        // Add the current attribute to the current group
        currentGroup.push(attr);

        // If this is a spread operator or the last attribute, close the current group
        if (attr.type === "JSXSpreadAttribute" || i === attributes.length - 1) {
          if (currentGroup.length > 0) {
            groups.push(currentGroup);
            currentGroup = [];
          }
        }
      }

      return groups;
    }

    // Sort each group internally while preserving spread operator positions
    function sortAttributesPreservingSpreadPrecedence(attributes) {
      // Early return if no sorting needed
      if (attributes.length <= 1) return attributes;

      const result = [];
      let currentGroup = [];

      for (let i = 0; i < attributes.length; i++) {
        const attr = attributes[i];

        // If we encounter a spread operator
        if (attr.type === "JSXSpreadAttribute") {
          // Sort and add the previous group if it exists
          if (currentGroup.length > 0) {
            const sortedGroup = [...currentGroup].sort(compareProps);
            result.push(...sortedGroup);
            currentGroup = [];
          }

          // Add the spread operator directly
          result.push(attr);
        } else {
          // Collect normal attributes in the current group
          currentGroup.push(attr);
        }
      }

      // Sort and add the last group if it exists
      if (currentGroup.length > 0) {
        const sortedGroup = [...currentGroup].sort(compareProps);
        result.push(...sortedGroup);
      }

      return result;
    }

    // Create fix for unordered props
    function createFix(node, attributes, sortedAttributes) {
      return fixer => {
        try {
          // Verify that all original attributes are present in the sorted list
          if (attributes.length !== sortedAttributes.length) {
            // Safety check failed - don't apply the fix
            return null;
          }

          // Create a map of all original attributes for safety check
          const originalAttrsSet = new Set(attributes);

          // Verify every sorted attribute was in the original set
          for (const attr of sortedAttributes) {
            if (!originalAttrsSet.has(attr)) {
              // Safety check failed - don't apply the fix
              return null;
            }
          }

          // Get component name
          const tagName = sourceCode.getText(node.name);

          // Extract indentation
          const nodeText = sourceCode.getText(node);
          const indentMatch = nodeText.match(/^\s*/);
          const indent = indentMatch ? indentMatch[0] : '';
          const attrIndent = indent + '  ';

          // Build the element with sorted attributes
          const sortedAttributesText = sortedAttributes
            .map(attr => {
              try {
                return sourceCode.getText(attr);
              } catch (error) {
                // If we can't get text for an attribute, return a placeholder to prevent data loss
                return `/* ESLint error: could not format attribute */`;
              }
            })
            .join('\n' + attrIndent);

          // Build the final result
          let fixedText = `<${tagName}\n${attrIndent}${sortedAttributesText}${node.selfClosing ? ' />' : '>'}`;

          // Apply the fix by replacing the entire opening element
          return fixer.replaceText(node, fixedText);
        } catch (error) {
          // If any error occurs during fix creation, don't apply the fix
          return null;
        }
      };
    }

    // Helper function to check if arrays are equivalent (for sorting)
    function areAttributesEquivalent(attrsA, attrsB) {
      if (attrsA.length !== attrsB.length) return false;

      for (let i = 0; i < attrsA.length; i++) {
        // Check if type matches
        if (attrsA[i].type !== attrsB[i].type) return false;

        // For regular attributes, compare props
        if (attrsA[i] !== attrsB[i]) return false;
      }
      return true;
    }

    return {
      JSXOpeningElement(node) {
        try {
          // Skip if no attributes or just one attribute
          if (!node.attributes || node.attributes.length <= 1) return;

          // Sort attributes while preserving spread operator precedence
          const sortedAttributes = sortAttributesPreservingSpreadPrecedence(node.attributes);

          // Check if already sorted
          const isSorted = areAttributesEquivalent(node.attributes, sortedAttributes);

          if (!isSorted) {
            // Verify that all attributes are preserved
            const allPreserved = node.attributes.length === sortedAttributes.length &&
              node.attributes.every(attr => sortedAttributes.includes(attr));

            if (allPreserved) {
              context.report({
                node,
                message: "JSX props should be sorted by type and length while preserving spread operator precedence",
                fix: createFix(node, node.attributes, sortedAttributes)
              });
            } else {
              // Report without fix if attributes might be lost
              context.report({
                node,
                message: "JSX props should be sorted by type and length (automatic fix unavailable to preserve all props)"
              });
            }
          }
        } catch (error) {
          // If any error occurs during rule processing, skip this node
          return;
        }
      }
    };
  }
};