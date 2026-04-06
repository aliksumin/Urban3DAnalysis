export function buildRoadGraph(hwys) {
    const nodes = new Map();
    
    const getNodeKey = (pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;
    
    hwys.forEach(hwy => {
        const pts = hwy.p;
        for (let i = 0; i < pts.length; i++) {
            const pt = pts[i];
            const key = getNodeKey(pt);
            if (!nodes.has(key)) {
                nodes.set(key, { id: key, x: pt[0], y: pt[1], edges: [] });
            }
            
            if (i > 0) {
                const prevPt = pts[i - 1];
                const prevKey = getNodeKey(prevPt);
                
                const dist = Math.sqrt(Math.pow(pt[0] - prevPt[0], 2) + Math.pow(pt[1] - prevPt[1], 2));
                
                // Avoid duplicate edges
                if (!nodes.get(key).edges.find(e => e.to === prevKey)) {
                    nodes.get(key).edges.push({ to: prevKey, dist });
                }
                if (!nodes.get(prevKey).edges.find(e => e.to === key)) {
                    nodes.get(prevKey).edges.push({ to: key, dist });
                }
            }
        }
    });

    return nodes;
}

export function computeWalkability(graph, startPt, maxDistMeters) {
    if (!graph || graph.size === 0 || !startPt) return { reachableNodes: [], paths: [] };
    
    let closestNode = null;
    let minDist = Infinity;
    
    for (const [key, node] of graph) {
        const dist = Math.sqrt(Math.pow(node.x - startPt[0], 2) + Math.pow(node.y - startPt[1], 2));
        if (dist < minDist) {
            minDist = dist;
            closestNode = key;
        }
    }
    
    // Snap to road threshold (150 meters)
    if (!closestNode || minDist > 150) return { reachableNodes: [], paths: [] }; 
    
    const distances = new Map();
    const pq = [{ id: closestNode, dist: 0 }];
    const previous = new Map();
    
    for (const key of graph.keys()) {
        distances.set(key, Infinity);
    }
    distances.set(closestNode, 0);
    
    while (pq.length > 0) {
        // Find smallest distance in pq (faster than full sort for small PQs, but sort is simpler)
        let minIdx = 0;
        for (let i = 1; i < pq.length; i++) {
            if (pq[i].dist < pq[minIdx].dist) minIdx = i;
        }
        const current = pq.splice(minIdx, 1)[0];
        
        if (current.dist > maxDistMeters) continue; 
        
        const node = graph.get(current.id);
        if (!node) continue;

        for (const edge of node.edges) {
            const altDist = current.dist + edge.dist;
            if (altDist < distances.get(edge.to) && altDist <= maxDistMeters) {
                distances.set(edge.to, altDist);
                previous.set(edge.to, current.id);
                pq.push({ id: edge.to, dist: altDist });
            }
        }
    }
    
    const reachableNodes = [];
    const paths = []; 
    
    for (const [id, dist] of distances) {
        if (dist <= maxDistMeters) {
            const node = graph.get(id);
            reachableNodes.push(node);
            
            const prevId = previous.get(id);
            if (prevId) {
                const prevNode = graph.get(prevId);
                paths.push([ [prevNode.x, prevNode.y], [node.x, node.y] ]);
            }
        }
    }
    
    return { reachableNodes, paths };
}
