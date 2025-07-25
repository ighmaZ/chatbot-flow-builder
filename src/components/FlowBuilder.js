'use client';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import ReactFlow, {
  Background,
  Controls,
  Position,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';

import NodePanelSidebar from './NodePanelSidebar';
import TextMessageNode from './nodes/TextMessageNode';
import CustomEdge from './edges/CustomEdge';
import Header from './Header';

// custom node/edge type components
const nodeTypes = {
  text: TextMessageNode,
};
const edgeTypes = {
  'custom-edge': CustomEdge,
};

export default function FlowBuilder() {
  const reactFlowWrapper = useRef(null);
  const idCounter = useRef(1);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);

  /**
   * Selected node state
   * to replace sidebar into editor window
   */
  const [selectedNode, setSelectedNode] = useState(null);

  const [showSaveAnimation, setShowSaveAnimation] = useState(false);

  /**
   * whenever a node is connected to another node,
   * this function will be called to add the edge
   */
  const onConnect = useCallback(
    (params) =>
      setEdges((eds) => {
        // one source can have one target
        if (eds.some((e) => e.source === params.source)) {
          alert('Source node is already connected to another node');
          return eds;
        }

        // if the target is already connected, add a default edge.
        // otherwise, add a custom edge.
        if (eds.some((e) => e.target === params.target)) {
          return addEdge({...params}, eds);
        }

        return addEdge({...params, type: 'custom-edge'}, eds);
      }),
    [setEdges],
  );

  /**
   * dragover event handler to prevent default behavior
   * and set the drop effect to move
   */
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * drop event handler to add a new node to the flow
   * whenever a node is dropped on the flow
   * it will create a new node with the type of the dropped element
   * and add it to the nodes array
   * and set the position of the new node to the mouse position
   */
  const onDrop = useCallback(
    (event) => {
      event.preventDefault();

      // validating if the dropped element is correct
      // we are getting type of the node from the dataTransfer
      const type = event.dataTransfer.getData('application/reactflow');
      if (typeof type === 'undefined' || !type) {
        return;
      }

      // mouse position
      const position = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      // creating a new node
      // and adding it to the nodes array
      const nid = `node_${idCounter.current++}`;
      const newNode = {
        id: nid,
        type,
        position,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: {
          value: `${type} ${nid}`,
          onClick: () => onNodeClick(null, {id: nid}),
        },
      };
      setNodes((nds) => nds.concat(newNode));
    },
    [reactFlowInstance, setNodes],
  );

  /**
   * on click handler for the nodes
   * to select the node and show the editor
   */
  const onNodeClick = useCallback((_, node) => setSelectedNode(node), []);

  /**
   * the core function to update the selected node value
   * whenever a node is selected and edited
   */
  const updateSelectedNode = (value) => {
    if (!selectedNode) {
      return;
    }

    // Update the nodes state with immutable updates for React Flow
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.id === selectedNode.id) {
          return {
            ...node,
            data: {
              ...node.data,
              value: value,
            },
          };
        }

        return node;
      }),
    );

    // Also update the selectedNode state to keep the editor in sync
    setSelectedNode((prevSelectedNode) => ({
      ...prevSelectedNode,
      data: {
        ...prevSelectedNode.data,
        value: value,
      },
    }));
  };

  /**
   * if there are more than one nodes,
   * and any one of the node does not have a connection from source to target
   * then the flow is invalid
   */
  const validateFlow = () => {
    // Check if there are more than one nodes and more than one node has empty target handles
    if (nodes.length > 1) {
      // Find nodes that have no incoming connections (empty target handles)
      const targetNodeIds = new Set(edges.map((edge) => edge.target));
      const nodesWithEmptyTargets = nodes.filter(
        (node) => !targetNodeIds.has(node.id),
      );

      if (nodesWithEmptyTargets.length > 1) {
        alert(
          'Error: More than one node has empty target handles. Each node except the start node should have an incoming connection.',
        );
        return;
      }
    }

    // A flow is considered valid if all nodes are connected.
    // This check identifies nodes that are not part of any edge.
    const connectedNodeIds = new Set(
      edges.flatMap((edge) => [edge.source, edge.target]),
    );

    const unconnectedNodes = nodes.filter(
      (node) => !connectedNodeIds.has(node.id),
    );

    if (unconnectedNodes.length > 0) {
      // This alert is from the original implementation.
      // It triggers even if there is only one unconnected node, making the message potentially misleading.
      alert('More than one nodes without source and target connections');
    } else {
      saveFlowToLocal();
    }
  };

  // save the flow to local storage
  const saveFlowToLocal = () => {
    localStorage.setItem('flow', JSON.stringify({nodes, edges}));
    setShowSaveAnimation(true);
  };

  /**
   * showing a saved icon when saved
   * and then hiding it after 800ms
   */
  useEffect(() => {
    if (showSaveAnimation) {
      const timeoutId = setTimeout(() => {
        setShowSaveAnimation(false);
      }, 800);

      return () => clearTimeout(timeoutId);
    }
  }, [showSaveAnimation]);

  // get the flow from local storage, on page load
  useEffect(() => {
    const flow = localStorage.getItem('flow');
    if (flow) {
      const {nodes, edges} = JSON.parse(flow);
      setNodes(nodes);
      setEdges(edges);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen">
      <Header
        onClickSave={validateFlow}
        showSaveAnimation={showSaveAnimation}
      />

      <div className="flex flex-row flex-grow h-full">
        <ReactFlowProvider>
          {/* left side will be reactflow component that has all the flow nodes, edges... */}
          {/* this is the flow builder canvas */}
          <div
            className="reactflow-wrapper w-3/4 h-full"
            ref={reactFlowWrapper}
          >
            <ReactFlow
              fitView
              nodes={nodes}
              edges={edges}
              onInit={setReactFlowInstance}
              // customizing nodes & edges
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              // dnd handlers
              onDrop={onDrop}
              onDragOver={onDragOver}
              // node and edges handlers
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              // selection handlers
              onNodeClick={onNodeClick}
              onPaneClick={() => setSelectedNode(null)}
              onEdgeClick={() => setSelectedNode(null)}
            >
              <Background />
              <Controls />
            </ReactFlow>
          </div>

          {/* right side has node panel (sidebar) to select nodes */}
          <div className="flex-grow border-s">
            <NodePanelSidebar
              selectedNode={selectedNode}
              cancelSelection={() => setSelectedNode(null)}
              updateSelectedNode={(value) => updateSelectedNode(value)}
            />
          </div>
        </ReactFlowProvider>
      </div>
    </div>
  );
}
