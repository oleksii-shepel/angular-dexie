import Dexie from 'dexie';

export interface StateNode {
  id?: number;
  key: string;
  left: number | undefined;
  right: number | undefined;
  parent: number | undefined;
  marker: number;
  data: any;
}

export class StateObjectDatabase extends Dexie {
  private _stateNodes!: Dexie.Table<StateNode, number>;
  public get stateNodes(): Dexie.Table<StateNode, number> {
    return this._stateNodes;
  }
  public set stateNodes(value: Dexie.Table<StateNode, number>) {
    this._stateNodes = value;
  }

  constructor() {
    super('StateObjectDatabase');
    this.version(1).stores({
      stateNodes: 'id, [id+key], parent',
    });
    this.stateNodes = this.table('stateNodes');
    this.on('populate', () => this.populate());
  }

  async clear() {
    return await this.stateNodes.clear();
  }

  async populate() {}

  async get(key: number): Promise<StateNode | undefined> {
    return this.stateNodes.get(key);
  }

  async set(node: StateNode): Promise<number> {
    return this.stateNodes.add(node);
  }

  async update(node: StateNode): Promise<number> {
    return this.stateNodes.put(node);
  }

  async remove(key: number): Promise<void> {
    return this.stateNodes.delete(key);
  }

  async toArray(): Promise<StateNode[]> {
    return this.stateNodes.toArray();
  }
}

export interface StateReader {
  find: (path: string | string[]) => Promise<StateNode | undefined>;
  get: (path: string | string[]) => Promise<any>;
}

export interface StateWriter {
  initialize: (obj: any) => Promise<StateNode | undefined>;
  update: (path: string, obj: any) => Promise<StateNode | undefined>;
}

export interface StateDescriptor {
  autoincrement: number;
  root: StateNode;
  date: number;
  reader: StateReader;
  writer: StateWriter;
  state: ObjectState;
}

export class ObjectState {
  db: StateObjectDatabase;
  root: StateNode | undefined;
  autoincrement: number;

  constructor() {
    this.db = new StateObjectDatabase();
    this.root = undefined;
    this.autoincrement = 0;
  }

  async descriptor(): Promise<StateDescriptor> {
    return {
      autoincrement: this.autoincrement,
      root: await this.rootNode(),
      date: Date.now(),
      state: this,
      reader: {
        get: (path) => this.get(Array.isArray(path) ? path.join('.') : path),
        find: (path) => this.find(Array.isArray(path) ? path.join('.') : path),
      },
      writer: {
        initialize: (obj) => this.initialize(obj),
        update: (path, value) =>
          this.update(Array.isArray(path) ? path.join('.') : path, value),
      },
    };
  }

  async rootNode(): Promise<StateNode> {
    try {
      // Retrieve the node using the ID
      this.root = await this.db.get(0);

      // If root is not yet set, create it
      if (!this.root) {
        const nodeId = await this.db.set({
          id: this.autoincrement,
          key: 'root',
          left: undefined,
          right: undefined,
          parent: undefined,
          data: undefined,
          marker: this.autoincrement,
        });

        this.root = await this.db.get(this.autoincrement);

        // Increment autoincrement after setting the root
        this.autoincrement++;
      }

      if (!this.root) {
        throw new Error('Failed to create or retrieve the root node');
      }

      return this.root;
    } catch (err) {
      console.error('Error in rootNode:', err);
      throw err;
    }
  }

  async leaf(id: number): Promise<boolean> {
    try {
      return await this.db.transaction('r', this.db.stateNodes, async () => {
        let nodeValue = await this.db.get(id);
        return nodeValue?.left === undefined;
      });
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }

  async createNode(
    key: string,
    data: any,
    parent: number | undefined
  ): Promise<StateNode | undefined> {
    try {
      return await this.db.transaction('rw', this.db.stateNodes, async () => {
        let nodeData = data;

        // If the parent node has `data` as an array, we handle it accordingly
        const parentNode =
          parent !== undefined
            ? await this.db.get(parent)
            : await this.rootNode();

        // Check if the parent node's `data` is an array
        if (Array.isArray(data)) {
          // If data is an array, check if all elements are primitive.
          // If yes, we can store the array directly in `nodeData`.
          nodeData =
            Array.isArray(data) &&
            data.length !== 0 &&
            data.every((item) => typeof item !== 'object' || item === null)
              ? data
              : []; // Otherwise, store as an empty array to handle nested structures.
        } else if (typeof data === 'object') {
          nodeData = {}; // Default to empty object if `data` is a complex object.
        }

        // Create and store the new node in the database
        const newNodeId = await this.db.set({
          id: this.autoincrement,
          key: key,
          left: undefined,
          right: undefined,
          parent: parent,
          data: nodeData,
          marker: this.autoincrement,
        });

        const newNode = await this.db.get(newNodeId);
        this.autoincrement++;

        // Update the parent's marker to reflect changes
        if (parent) await this.updateMarker(parent);

        // Link new node into parent's left-right structure
        if (parentNode) {
          if (parentNode.left === undefined) {
            // If no children exist, set this new node as the first child
            parentNode.left = newNode?.id!;
            await this.db.update(parentNode); // Save the updated parent
          } else {
            // Traverse to the last sibling and link the new node as the right sibling
            let lastChild = await this.db.get(parentNode.left);
            while (lastChild?.right) {
              lastChild = await this.db.get(lastChild.right);
            }

            if (lastChild) {
              lastChild.right = newNode?.id!;
              await this.db.update(lastChild); // Save the updated last child
            }
          }
        }

        return newNode;
      });
    } catch (err: any) {
      console.error('Error creating node:', err);
      return Promise.reject(err.message);
    }
  }

  async updateMarker(nodeId: number | undefined) {
    while (nodeId !== undefined) {
      const node = await this.db.get(nodeId);
      if (node) {
        node.marker = this.autoincrement;
        await this.db.update(node);
        nodeId = node.parent;
      } else {
        break;
      }
    }
  }

  async getNode(id: number): Promise<StateNode | undefined> {
    try {
      return await this.db.transaction('r', this.db.stateNodes, async () => {
        return await this.db.get(id);
      });
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }

  async getChildNodes(id: number): Promise<StateNode[] | undefined> {
    try {
      return await this.db.transaction('r', this.db.stateNodes, async () => {
        const node = await this.db.get(id);

        if (node && node.left !== undefined) {
          const children: StateNode[] = [];
          let currentChild = await this.db.get(node.left);

          while (currentChild !== undefined) {
            children.push(currentChild);
            currentChild =
              currentChild.right !== undefined
                ? await this.db.get(currentChild.right)
                : undefined;
          }

          return children;
        }

        return undefined;
      });
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }

  async deleteNode(id: number) {
    try {
      await this.db.transaction('rw', this.db.stateNodes, async () => {
        const node = await this.db.get(id);
        if (!node) return;

        // Recursively delete the left child and its siblings
        let leftChildId = node.left;
        while (leftChildId) {
          const leftChild = await this.db.get(leftChildId);
          if (leftChild) {
            await this.deleteNode(leftChild.id!);
            leftChildId = leftChild.right;
          } else {
            leftChildId = undefined;
          }
        }

        // Delete the node
        await this.db.remove(id);
        if (node.parent === undefined) {
          this.root = undefined; // Handle the root case
        }

        await this.updateMarker(node.parent); // Update parent markers
      });
    } catch (err) {
      console.error('Failed to delete node with id:', id, err);
      throw err;
    }
  }

  async getData(node: StateNode): Promise<any> {
    try {
      return await this.db.transaction('r', this.db.stateNodes, async () => {
        if (!node) {
          throw new Error('Tree node cannot be undefined');
        }

        // Directly return primitive arrays if stored in data
        if (
          Array.isArray(node.data) &&
          node.data.length !== 0 &&
          node.data.every((item) => typeof item !== 'object' || item === null)
        ) {
          return node.data;
        }

        // Determine whether the node should be processed as an array or an object
        let isArray = Array.isArray(node.data);
        let data: any = isArray ? [] : {};

        // Use getChildNodes to retrieve all child nodes
        const children = await this.getChildNodes(node.id!);

        if (children) {
          if (isArray) {
            // Populate array for compound array nodes
            for (const child of children) {
              data.push(await this.getData(child)); // Recursively get each child's data
            }
          } else {
            // Populate object for regular object structures
            for (const child of children) {
              data[child.key] = await this.getData(child); // Recursively assign each child's data
            }
          }
        } else {
          // If no children, use the node's own data
          data = node.data;
        }

        return data;
      });
    } catch (err: any) {
      console.error('Error fetching data:', err);
      return Promise.reject(err.message);
    }
  }

  async initialize(obj: any): Promise<StateNode | undefined> {
    try {
      return await this.db.transaction('rw', this.db.stateNodes, async () => {
        // Reset the database and state
        this.root = undefined;
        this.autoincrement = 0;
        await this.db.clear();

        // Create the root node
        const rootNode = await this.rootNode();
        const root = rootNode?.id;

        // Initialize a queue to process each node
        let queue = [{ obj: obj, parent: root, previousSibling: undefined }];

        while (queue.length > 0) {
          let { obj, parent, previousSibling } = queue.shift() as {
            obj: any;
            parent: number | undefined;
            previousSibling: number | undefined;
          };
          let firstChild: number | undefined = undefined;

          for (const key in obj) {
            const value = obj[key];

            // Corrected handling for arrays:
            // If it's an array of primitives, store it in `data`.
            // Otherwise, treat it as a compound object and process its elements recursively.
            let nodeData = undefined;
            if (Array.isArray(value)) {
              // Check if it's an array of primitives
              if (
                value.every((item) => typeof item !== 'object' || item === null)
              ) {
                nodeData = value; // Store the array of primitives directly in data
              } else {
                nodeData = []; // Store an empty array for complex objects, to process children
              }
            } else if (typeof value === 'object') {
              nodeData = {}; // Store an empty object for further recursive processing
            } else {
              nodeData = value;
            }

            const record = await this.createNode(key, nodeData, parent);

            if (!record) {
              throw new Error('Failed to create a node');
            }

            // Set the first child for the parent node
            if (!firstChild) {
              firstChild = record.id;
              const parentNode = await this.db.get(parent!);
              if (parentNode) {
                parentNode.left = firstChild;
                await this.db.update(parentNode);
              }
            } else {
              // Set the right link for the previous sibling
              const prevSiblingNode = await this.db.get(previousSibling!);
              if (prevSiblingNode) {
                prevSiblingNode.right = record.id;
                await this.db.update(prevSiblingNode);
              }
            }

            // Update the previous sibling reference
            previousSibling = record.id;

            // For compound arrays and objects, enqueue children
            if (Array.isArray(value) || typeof value === 'object') {
              if (Array.isArray(value)) {
                // Store an empty array for arrays with complex elements
                record.data = [];
              } else {
                // For objects, store an empty object
                record.data = {};
              }
              await this.db.update(record);

              // Enqueue the children for further processing
              queue.push({
                obj: value,
                parent: record.id,
                previousSibling: undefined,
              });
            }
          }
        }

        return rootNode;
      });
    } catch (err) {
      console.error('Error initializing tree:', err);
      throw err;
    }
  }

  async find(path: string | undefined): Promise<StateNode | undefined> {
    try {
      return await this.db.transaction('r', this.db.stateNodes, async () => {
        let node = await this.rootNode();

        if (typeof path === 'string' && path.length > 0) {
          const split = path.split('.');

          for (const part of split) {
            let nextChild =
              node && node.left !== undefined
                ? await this.db.get(node.left)
                : undefined;

            while (nextChild !== undefined && nextChild.key !== part) {
              nextChild =
                nextChild.right !== undefined
                  ? await this.db.get(nextChild.right)
                  : undefined;
            }

            // If no matching child is found for this part, exit early
            if (!nextChild) return undefined;

            // Move to the found child node and continue with the next path part
            node = nextChild;
          }
        }

        return node; // Return the last found node, or the root node if no path was provided
      });
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }

  async get(path: string): Promise<any> {
    try {
      return await this.db.transaction('r', this.db.stateNodes, async () => {
        let subtree = await this.find(path);
        return subtree !== undefined ? await this.getData(subtree) : undefined;
      });
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }

  async create(path: string, obj: any): Promise<StateNode | undefined> {
    try {
      return await this.db.transaction('rw', this.db.stateNodes, async () => {
        // Find the parent node based on path (or use root node if not found)
        const parentPath = path.substring(0, path.lastIndexOf('.'));
        let parentNode = await this.find(parentPath);

        if (!parentNode) {
          console.error(`Parent node not found for path: ${parentPath}`); // Log the parent path
          // Optionally create the parent node if it doesn't exist
          // parentNode = await this.createNode(parentPath, {}, undefined); // Uncomment if needed
          return;
        }

        // Create the new node for the current key-value pair
        const nodeKey = path.substring(path.lastIndexOf('.') + 1);
        await this.createNode(nodeKey, obj, parentNode.id);

        if (typeof obj === 'object') {
          // Iterate over the keys of the obj and create child nodes recursively
          for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
              await this.create(path + '.' + key, obj[key]); // Recurse to create nested nodes
            }
          }
        }

        return parentNode; // Return the parent node after all children are created
      });
    } catch (err) {
      console.error('Failed to create node:', err);
      throw err;
    }
  }

  async update(path: string, obj: any) {
    try {
      return await this.db.transaction('rw', this.db.stateNodes, async () => {
        await this.delete(path);
        return await this.create(path, obj);
      });
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }

  async delete(path: string): Promise<void> {
    try {
      await this.db.transaction('rw', this.db.stateNodes, async () => {
        const nodeToDelete = await this.find(path);
        if (!nodeToDelete) return;

        // If the node to delete is the root, set the root to undefined
        if (this.root === nodeToDelete) {
          this.root = undefined;
          this.autoincrement = 0;
          this.db.clear();
        } else {
          // Proceed with deleting the subtree
          await this.deleteSubtree(nodeToDelete.left);

          // Now, delete the node and update its parent's child reference
          const parent = nodeToDelete.parent !== undefined
            ? await this.db.get(nodeToDelete.parent)
            : undefined;

          if (parent) {
            // If the node is the left child of the parent
            if (parent.left === nodeToDelete.id) {
              parent.left = nodeToDelete.right;
              await this.db.update(parent); // Update the parent node in the database
            } else {
              // Find and update the sibling if the node is the right child
              let current = parent.left !== undefined
                ? await this.db.get(parent.left)
                : undefined;

              while (current?.right && current.right !== nodeToDelete.id) {
                current = await this.db.get(current.right);
              }
              if (current) {
                current.right = nodeToDelete.right;
                await this.db.update(current); // Update the current node in the database
              }
            }
          }
        }

        // Finally, delete the node itself (recursively if needed)
        await this.deleteNode(nodeToDelete.id!);
      });
    } catch (err) {
      console.error('Failed to delete node:', err);
      throw err;
    }
  }

  async deleteSubtree(id: number | undefined) {
    try {
      if (id === undefined) return;

      const node = await this.db.get(id);
      if (node) {
        let childId = node.left;
        while (childId !== undefined) {
          const childNode = await this.db.get(childId);
          if (childNode) {
            // Recursively delete the left child
            if (childNode.left !== undefined) {
              await this.deleteSubtree(childNode.left);
            }
            const rightSiblingId = childNode.right;
            await this.deleteNode(childId); // Delete the current child node
            childId = rightSiblingId;
          }
        }
      }
    } catch (err: any) {
      return Promise.reject(err.message);
    }
  }
}
