// Test file for CST parsing

export function testFunction() {
  console.log("Hello, World!");
}

export const arrowFunction = () => {
  return "Arrow function";
};

export async function asyncFunction() {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return "Async function";
}

export const asyncArrowFunction = async () => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return "Async arrow function";
};

class TestClass {
  method() {
    return "Method";
  }

  async asyncMethod() {
    return "Async method";
  }
}

export default TestClass;
