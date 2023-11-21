// Define a TreeNode interface
export interface TreeNode {
  id: number; // a unique id for the node
  left: number | null; // the left child id of the node
  right: number | null; // the right sibling id of the node
  parent: number | null; // the parent id of the node
  data: any; // the data of the node
}

// Define a Tree class
export class Tree {
  root: TreeNode | null; // the root node of the tree
  size: number; // the number of nodes in the tree

  constructor() {
    this.root = null;
    this.size = 0;
  }

  // Create a new node with the given data and parent id
  createNode(data: any, parent: number | null): number | null {
    // If the parent id is null, create the root node
    if (parent === null) {
      // If the root node already exists, return null
      if (this.root !== null) return null;
      // Otherwise, create the root node with id 1
      this.root = {
        id: 1,
        left: null,
        right: null,
        parent: null,
        data: data,
      };
      // Increment the size of the tree
      this.size++;
      // Return the id of the root node
      return 1;
    }
    // Otherwise, find the parent node
    let parentNode = this.findNode(parent);
    // If the parent node is not found, return null
    if (parentNode === null) return null;
    // Otherwise, create a new node with a unique id
    let newNode: TreeNode = {
      id: this.size + 1,
      left: null,
      right: null,
      parent: parent,
      data: data,
    };
    // Increment the size of the tree
    this.size++;
    // If the parent node has no children, add the new node as the left child
    if (parentNode.left === null) {
      parentNode.left = newNode.id;
    }
    // Otherwise, find the rightmost sibling of the parent node's left child
    else {
      let siblingNode = this.findNode(parentNode.left);
      while (siblingNode !== null && siblingNode.right !== null) {
        siblingNode = this.findNode(siblingNode.right);
      }
      // Add the new node as the right sibling of the rightmost sibling
      if (siblingNode !== null) {
        siblingNode.right = newNode.id;
      }
    }
    // Return the id of the new node
    return newNode.id;
  }

  // Find the node with the given id
  findNode(id: number): TreeNode | null {
    // If the id is invalid, return null
    if (id < 1 || id > this.size) return null;
    // Otherwise, use a queue to perform a level-order traversal of the tree
    let queue: TreeNode[] = [];
    if (this.root !== null) queue.push(this.root);
    while (queue.length > 0) {
      // Dequeue the first node in the queue
      let node = queue.shift() as TreeNode;
      // If the node has the given id, return it
      if (node.id === id) return node;
      // Otherwise, enqueue the left child and the right sibling of the node
      if (node.left !== null) {
        let leftChild = this.findNode(node.left);
        if (leftChild !== null) queue.push(leftChild);
      }
      if (node.right !== null) {
        let rightSibling = this.findNode(node.right);
        if (rightSibling !== null) queue.push(rightSibling);
      }
    }
    // If the node is not found, return null
    return null;
  }

  // Update the data of the node with the given id
  updateNode(id: number, data: any): boolean {
    // Find the node with the given id
    let node = this.findNode(id);
    // If the node is not found, return false
    if (node === null) return false;
    // Otherwise, update the data of the node and return true
    node.data = data;
    return true;
  }

  // Delete the node with the given id
  deleteNode(id: number): boolean {
    // Find the node with the given id
    let node = this.findNode(id);
    // If the node is not found, return false
    if (node === null) return false;
    // Otherwise, delete the node and update the links of the parent, left child, and right sibling nodes
    // If the node is the root node, set the root to null
    if (node.parent === null) {
      this.root = null;
    }
    // Otherwise, find the parent node
    else {
      let parentNode = this.findNode(node.parent);
      // If the node is the left child of the parent node, set the parent node's left child to the node's right sibling
      if (parentNode !== null && parentNode.left === node.id) {
        parentNode.left = node.right;
      }
      // Otherwise, find the left sibling of the node
      else {
        let siblingNode = this.findNode(parentNode?.left as number);
        while (siblingNode !== null && siblingNode.right !== node.id) {
          siblingNode = this.findNode(siblingNode.right as number);
        }
        // Set the left sibling's right sibling to the node's right sibling
        if (siblingNode !== null) {
          siblingNode.right = node.right;
        }
      }
    }
    // If the node has a left child, delete the left child and its right siblings recursively
    if (node.left !== null) {
      this.deleteNode(node.left);
    }
    // Decrement the size of the tree
    this.size--;
    // Return true
    return true;
  }
}

// Example usage
let tree = new Tree();
console.log(tree.createNode("A", null)); // 1
console.log(tree.createNode("B", 1)); // 2
console.log(tree.createNode("C", 1)); // 3
console.log(tree.createNode("D", 1)); // 4
console.log(tree.createNode("E", 2)); // 5
console.log(tree.createNode("F", 2)); // 6
console.log(tree.createNode("G", 4)); // 7
console.log(tree.createNode("H", 4)); // 8
console.log(tree.findNode(3)); // { id: 3, left: null, right: 4, parent: 1, data: 'C' }
console.log(tree.updateNode(5, "X")); // true
console.log(tree.deleteNode(4)); // true
console.log(tree.findNode(4)); // null
console.log(tree.findNode(7)); // null
console.log(tree.findNode(8)); // null
