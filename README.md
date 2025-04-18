# eslint-plugin-react-jsx-props-sorter

> 🔧 ESLint plugin to automatically sort JSX props by **type** and **length**, prioritizing React reserved props.

## ✨ Features

This plugin enforces a consistent and readable order of JSX props in your React components based on the following rules:

1. **React reserved props first** – props like `key`, `ref`, `className`, `style`, etc., are placed at the top.
2. **Categorized by type**, in the following order:
   - React reserved props
   - Shorthand props (`<Component disabled />`)
   - String literals (`title="Hello"`)
   - Variables (`value={someValue}`)
   - Functions (`onClick={handleClick}`)
   - Multiline objects or functions
3. **Within each category**:
   - Sorted by prop name length (shorter first)
   - Then alphabetically
   - For multiline props, sorted by number of lines

## 📦 Installation

```bash
npm install --save-dev eslint-plugin-react-jsx-props-sorter
```

or

```bash
yarn add --dev eslint-plugin-react-jsx-props-sorter
```

or

```bash
pnpm add -D eslint-plugin-react-jsx-props-sorter
```

## 🛠 Configuration

In your ESLint config:

```json
{
  "plugins": ["jsx-props-sorter"],
  "rules": {
    "jsx-props-sorter/sort-jsx-props": ["warn", {
      "reactPropsFirst": true,
      "reactPropsList": [
        "key", "ref", "dangerouslySetInnerHTML", "children",
        "value", "defaultValue", "checked", "defaultChecked",
        "className", "style", "id", "name"
      ]
    }]
  }
}
```

## ⚙️ Options

| Option             | Type       | Default | Description                                              |
|--------------------|------------|---------|----------------------------------------------------------|
| `reactPropsFirst`  | `boolean`  | `true`  | Whether to prioritize React props at the top             |
| `reactPropsList`   | `string[]` | [...]*  | List of React-related props to prioritize                |

> \* Default `reactPropsList`:
```js
[
  "key", "ref", "dangerouslySetInnerHTML"
]
```

## 🧠 Example

Before:

```tsx
const userData = {
  id: 1,
  name: 'Gabriel Felipe'
};

const handleClick = () => {
  // ...
};

<Component
  size="xs"
  key="test"
  asChild
  buttonText="Click here!"
  className="rounded-md"
  onClick={handleClick}
  user={userData}
  onBlur={(event) => {
    const value = event.target.value;
    setValue(value);
  }}
  onFocus={(event) => {
    const value = event.target.value;
    setValue((oldState) => ({
      ...oldState,
      ...value,
    }));
  }}
  data={{
    test: 1,
    testTwo: 2,
    testThree: 3,
  }}
/>
```

After:

```tsx
const userData = {
  id: 1,
  name: 'Gabriel Felipe'
};

const handleClick = () => {
  // ...
};

<Component
  key="test"
  asChild
  size="xs"
  className="rounded-md"
  buttonText="Click here!"
  user={userData}
  onClick={handleClick}
  data={{
    test: 1,
    testTwo: 2,
    testThree: 3,
  }}
  onBlur={(event) => {
    const value = event.target.value;
    setValue(value);
  }}
  onFocus={(event) => {
    const value = event.target.value;
    setValue((oldState) => ({
      ...oldState,
      ...value,
    }));
  }}
/>
```

## 👤 Author

[Gabriel Felipe Cegatta dos Santos](https://github.com/gabrielfcs)

## 📄 License

MIT
