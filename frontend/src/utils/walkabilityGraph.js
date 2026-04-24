export function buildRoadGraph(hwys, getEl) {
    const nodes = new Map();
    const getNodeKey = (pt) => `${pt[0].toFixed(2)},${pt[1].toFixed(2)}`;

    hwys.forEach(hwy => {
        const pts = hwy.p;
        const ls = hwy.ls;
        for (let i = 0; i < pts.length; i++) {
            const pt = pts[i];
            const coord = ls[i];
            const key = getNodeKey(pt);
            
            if (!nodes.has(key)) {
                const z = getEl ? getEl(coord[0], coord[1]) : 0;
                nodes.set(key, { id: key, x: pt[0], y: pt[1], z, edges: [] });
            }
            
            if (i > 0) {
                const startPt = pts[i - 1];
                const startCoord = ls[i - 1];
                
                const fullDist = Math.sqrt(Math.pow(pt[0] - startPt[0], 2) + Math.pow(pt[1] - startPt[1], 2));
                const slices = Math.ceil(fullDist / 25.0);
                
                let prevKeyLocal = getNodeKey(startPt);
                
                for (let s = 1; s <= slices; s++) {
                    const f = s / slices;
                    const subPt = [
                        startPt[0] + (pt[0] - startPt[0]) * f,
                        startPt[1] + (pt[1] - startPt[1]) * f
                    ];
                    const subCoord = [
                        startCoord[0] + (coord[0] - startCoord[0]) * f,
                        startCoord[1] + (coord[1] - startCoord[1]) * f
                    ];
                    const subKey = (s === slices) ? key : getNodeKey(subPt);
                    
                    if (!nodes.has(subKey)) {
                        const z = getEl ? getEl(subCoord[0], subCoord[1]) : 0;
                        nodes.set(subKey, { id: subKey, x: subPt[0], y: subPt[1], z, edges: [] });
                    }
                    
                    const nodeCurrent = nodes.get(subKey);
                    const nodePrev = nodes.get(prevKeyLocal);
                    
                    const dx = nodeCurrent.x - nodePrev.x;
                    const dy = nodeCurrent.y - nodePrev.y;
                    const distLocal = Math.sqrt(dx * dx + dy * dy);
                    
                    // Add directed edge FROM current TO prev
                    if (!nodeCurrent.edges.find(e => e.to === prevKeyLocal)) {
                        let cost = distLocal;
                        if (nodeCurrent.z !== undefined && nodePrev.z !== undefined) {
                            const dz = nodePrev.z - nodeCurrent.z; 
                            if (dz >= 10) cost = distLocal * 2.0; 
                        }
                        nodeCurrent.edges.push({ to: prevKeyLocal, dist: cost });
                    }
                    
                    // Add directed edge FROM prev TO current
                    if (!nodePrev.edges.find(e => e.to === subKey)) {
                        let cost = distLocal;
                        if (nodePrev.z !== undefined && nodeCurrent.z !== undefined) {
                            const dz = nodeCurrent.z - nodePrev.z; 
                            if (dz >= 10) cost = distLocal * 2.0; 
                        }
                        nodePrev.edges.push({ to: subKey, dist: cost });
                    }
                    
                    prevKeyLocal = subKey;
                }
            }
        }
    });

    // Proximity Linking: Connect visually mapped but mathematically disjoint OSM intersections 
    // within a 10-meter footprint to form a robust, continuous pedestrian network
    const spatialHash = new Map();
    const hashSize = 25; // Broad grid cell
    const getHash = (x, y) => `${Math.floor(x / hashSize)},${Math.floor(y / hashSize)}`;
    
    for (const [key, node] of nodes.entries()) {
        const hash = getHash(node.x, node.y);
        if (!spatialHash.has(hash)) spatialHash.set(hash, []);
        spatialHash.get(hash).push(node);
    }
    
    for (const [key, node] of nodes.entries()) {
        const hx = Math.floor(node.x / hashSize);
        const hy = Math.floor(node.y / hashSize);
        
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const adjHash = `${hx + dx},${hy + dy}`;
                const cell = spatialHash.get(adjHash);
                if (cell) {
                    for (const other of cell) {
                        if (other.id !== node.id) {
                            const d = Math.sqrt(Math.pow(node.x - other.x, 2) + Math.pow(node.y - other.y, 2));
                            if (d > 0 && d <= 10.0) { // Orphaned nodes strictly within 10 meters
                                if (!node.edges.find(e => e.to === other.id)) {
                                    let cost = d;
                                    if (node.z !== undefined && other.z !== undefined) {
                                        if (other.z - node.z >= 10) cost = d * 2.0;
                                    }
                                    node.edges.push({ to: other.id, dist: cost });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

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
    
    class MinHeap {
        constructor() { this.data = []; }
        push(val) {
            this.data.push(val);
            this.bubbleUp(this.data.length - 1);
        }
        pop() {
            if (this.data.length === 1) return this.data.pop();
            const top = this.data[0];
            this.data[0] = this.data.pop();
            this.bubbleDown(0);
            return top;
        }
        bubbleUp(idx) {
            while (idx > 0) {
                let p = Math.floor((idx - 1) / 2);
                if (this.data[idx].dist >= this.data[p].dist) break;
                [this.data[idx], this.data[p]] = [this.data[p], this.data[idx]];
                idx = p;
            }
        }
        bubbleDown(idx) {
            const len = this.data.length;
            while (true) {
                let left = 2 * idx + 1, right = 2 * idx + 2, smallest = idx;
                if (left < len && this.data[left].dist < this.data[smallest].dist) smallest = left;
                if (right < len && this.data[right].dist < this.data[smallest].dist) smallest = right;
                if (smallest === idx) break;
                [this.data[idx], this.data[smallest]] = [this.data[smallest], this.data[idx]];
                idx = smallest;
            }
        }
        get length() { return this.data.length; }
    }

    const distances = new Map();
    const pq = new MinHeap();
    pq.push({ id: closestNode, dist: 0 });
    const previous = new Map();
    
    for (const key of graph.keys()) {
        distances.set(key, Infinity);
    }
    distances.set(closestNode, 0);
    
    while (pq.length > 0) {
        const current = pq.pop();
        
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
