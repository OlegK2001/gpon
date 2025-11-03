import { useRef, useEffect, useState } from 'react';
import { useSimulatorStore } from '@/store/simulatorStore';
import { NetworkNode, NetworkLink, Packet } from '@/types/network';

export const NetworkCanvas = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const { nodes, links, packets, updateNode, setSelectedNode, isRunning } = useSimulatorStore();

  // Draw packets animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrame: number;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const now = Date.now();
      packets.forEach((packet) => {
        const link = links.find((l) => l.id === packet.linkId);
        if (!link) return;

        const sourceNode = nodes.find((n) => n.id === link.source);
        const targetNode = nodes.find((n) => n.id === link.target);
        if (!sourceNode || !targetNode) return;

        const progress = Math.min(1, (now - packet.startTime) / packet.duration);
        
        const x = sourceNode.position.x + (targetNode.position.x - sourceNode.position.x) * progress;
        const y = sourceNode.position.y + (targetNode.position.y - sourceNode.position.y) * progress;

        ctx.beginPath();
        ctx.arc(x, y, 4, 0, Math.PI * 2);
        ctx.fillStyle = packet.color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = packet.color;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      animationFrame = requestAnimationFrame(animate);
    };

    if (isRunning) {
      animate();
    }

    return () => {
      if (animationFrame) cancelAnimationFrame(animationFrame);
    };
  }, [packets, links, nodes, isRunning]);

  // Calculate link path; draw from circle centers (user request)
  const getLinkPath = (link: NetworkLink) => {
    const source = nodes.find((n) => n.id === link.source);
    const target = nodes.find((n) => n.id === link.target);
    
    if (!source || !target) return '';

    const dx = target.position.x - source.position.x;
    const dy = target.position.y - source.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance === 0) return '';

    // Draw center-to-center
    const startX = source.position.x;
    const startY = source.position.y;
    const endX = target.position.x;
    const endY = target.position.y;

    return `M ${startX} ${startY} L ${endX} ${endY}`;
  };

  const handleMouseDown = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    setDraggingNode(nodeId);
    setDragOffset({
      x: e.clientX - svgRect.left - node.position.x,
      y: e.clientY - svgRect.top - node.position.y,
    });
    setSelectedNode(nodeId);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNode) return;

    const svgRect = svgRef.current?.getBoundingClientRect();
    if (!svgRect) return;

    const newX = e.clientX - svgRect.left - dragOffset.x;
    const newY = e.clientY - svgRect.top - dragOffset.y;

    updateNode(draggingNode, {
      position: { x: newX, y: newY },
    });
  };

  const handleMouseUp = () => {
    setDraggingNode(null);
  };

  const getNodeColor = (node: NetworkNode) => {
    switch (node.status) {
      case 'normal':
        return 'hsl(142, 76%, 36%)';
      case 'degraded':
        return 'hsl(38, 92%, 50%)';
      case 'under_attack':
        return 'hsl(25, 95%, 53%)';
      case 'failed':
        return 'hsl(0, 84%, 60%)';
      default:
        return 'hsl(189, 94%, 43%)';
    }
  };

  const getLinkStyle = (link: NetworkLink) => {
    const baseColor = 'hsl(189, 94%, 43%)';
    const strokeWidth = 2 + link.utilization * 2;
    const strokeDasharray = link.type === 'pon' ? '5,5' : 'none';

    return {
      stroke: link.status === 'active' ? baseColor : 'hsl(0, 84%, 60%)',
      strokeWidth,
      strokeDasharray,
      opacity: 0.6,
    };
  };

  return (
    <div className="relative w-full h-full bg-gradient-background">
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="10"
            refX="9"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 10 3, 0 6" fill="hsl(189, 94%, 43%)" />
          </marker>
        </defs>

        {/* Links */}
        {links.map((link) => (
          <g key={link.id}>
            <path
              d={getLinkPath(link)}
              fill="none"
              {...getLinkStyle(link)}
              markerEnd="url(#arrowhead)"
              className="transition-all duration-300"
            />
          </g>
        ))}

        {/* Nodes */}
        {nodes.map((node) => (
          <g
            key={node.id}
            data-node-id={node.id}
            onMouseDown={(e) => handleMouseDown(node.id, e)}
            className="cursor-move"
          >
            <circle
              cx={node.position.x}
              cy={node.position.y}
              r={node.radius}
              fill={getNodeColor(node)}
              stroke="hsl(189, 100%, 60%)"
              strokeWidth="2"
              className="transition-all duration-300"
              style={{
                filter: 'drop-shadow(0 0 10px currentColor)',
              }}
            />
            <text
              x={node.position.x}
              y={node.position.y}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="white"
              fontSize="12"
              fontWeight="bold"
              pointerEvents="none"
              paintOrder="stroke"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={2}
            >
              {node.type}
            </text>
            <text
              x={node.position.x}
              y={node.position.y + node.radius + 15}
              textAnchor="middle"
              fill="hsl(210, 40%, 98%)"
              fontSize="10"
              pointerEvents="none"
              paintOrder="stroke"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={2}
            >
              {node.label}
            </text>
            <text
              x={node.position.x}
              y={node.position.y + node.radius + 28}
              textAnchor="middle"
              fill="hsl(215, 20%, 65%)"
              fontSize="9"
              pointerEvents="none"
              paintOrder="stroke"
              stroke="rgba(0,0,0,0.7)"
              strokeWidth={2}
            >
              {node.ip}
            </text>
          </g>
        ))}
      </svg>

      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full pointer-events-none"
        width={1920}
        height={1080}
      />
    </div>
  );
};
