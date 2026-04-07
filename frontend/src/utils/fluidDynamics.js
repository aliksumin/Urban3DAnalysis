export class FluidSolver {
    constructor(n) {
        this.n = n;
        this.size = (n + 2) * (n + 2);
        this.dt = 0.1;
        this.visc = 0.001;
        
        this.u = new Float32Array(this.size);
        this.v = new Float32Array(this.size);
        this.u_prev = new Float32Array(this.size);
        this.v_prev = new Float32Array(this.size);
        this.obstacles = new Uint8Array(this.size);
    }
    
    IX(x, y) {
        return x + (this.n + 2) * y;
    }

    swapU() { let tmp = this.u; this.u = this.u_prev; this.u_prev = tmp; }
    swapV() { let tmp = this.v; this.v = this.v_prev; this.v_prev = tmp; }

    addVelocity(x, y, amountX, amountY) {
        const idx = this.IX(x, y);
        this.u[idx] += amountX;
        this.v[idx] += amountY;
    }

    setObstacles(data) {
        this.obstacles.set(data);
    }

    setBoundary(b, x) {
        const n = this.n;
        for (let i = 1; i <= n; i++) {
            x[this.IX(0, i)] = b === 1 ? -x[this.IX(1, i)] : x[this.IX(1, i)];
            x[this.IX(n + 1, i)] = b === 1 ? -x[this.IX(n, i)] : x[this.IX(n, i)];
            x[this.IX(i, 0)] = b === 2 ? -x[this.IX(i, 1)] : x[this.IX(i, 1)];
            x[this.IX(i, n + 1)] = b === 2 ? -x[this.IX(i, n)] : x[this.IX(i, n)];
        }
        
        x[this.IX(0, 0)] = 0.5 * (x[this.IX(1, 0)] + x[this.IX(0, 1)]);
        x[this.IX(0, n + 1)] = 0.5 * (x[this.IX(1, n + 1)] + x[this.IX(0, n)]);
        x[this.IX(n + 1, 0)] = 0.5 * (x[this.IX(n, 0)] + x[this.IX(n + 1, 1)]);
        x[this.IX(n + 1, n + 1)] = 0.5 * (x[this.IX(n, n + 1)] + x[this.IX(n + 1, n)]);

        // Solid obstacle boundaries (Bounce back no-slip)
        for (let j = 1; j <= n; j++) {
            for (let i = 1; i <= n; i++) {
                if (this.obstacles[this.IX(i, j)]) {
                    x[this.IX(i, j)] = 0;
                }
            }
        }
    }

    lin_solve(b, x, x0, a, c) {
        const n = this.n;
        for (let k = 0; k < 15; k++) {
            for (let j = 1; j <= n; j++) {
                for (let i = 1; i <= n; i++) {
                    if (this.obstacles[this.IX(i, j)]) continue;
                    let val = x0[this.IX(i, j)] + a * (x[this.IX(i - 1, j)] + x[this.IX(i + 1, j)] + x[this.IX(i, j - 1)] + x[this.IX(i, j + 1)]);
                    x[this.IX(i, j)] = val / c;
                }
            }
            this.setBoundary(b, x);
        }
    }

    diffuse(b, x, x0, visc) {
        const a = this.dt * visc * this.n * this.n;
        this.lin_solve(b, x, x0, a, 1 + 4 * a);
    }

    advect(b, d, d0, u, v) {
        const n = this.n;
        const dt0 = this.dt * n;
        for (let j = 1; j <= n; j++) {
            for (let i = 1; i <= n; i++) {
                if (this.obstacles[this.IX(i, j)]) continue;
                
                let x = i - dt0 * u[this.IX(i, j)];
                let y = j - dt0 * v[this.IX(i, j)];
                
                if (x < 0.5) x = 0.5;
                if (x > n + 0.5) x = n + 0.5;
                let i0 = Math.floor(x);
                let i1 = i0 + 1;
                
                if (y < 0.5) y = 0.5;
                if (y > n + 0.5) y = n + 0.5;
                let j0 = Math.floor(y);
                let j1 = j0 + 1;
                
                let s1 = x - i0; let s0 = 1.0 - s1;
                let t1 = y - j0; let t0 = 1.0 - t1;
                
                d[this.IX(i, j)] = 
                    s0 * (t0 * d0[this.IX(i0, j0)] + t1 * d0[this.IX(i0, j1)]) +
                    s1 * (t0 * d0[this.IX(i1, j0)] + t1 * d0[this.IX(i1, j1)]);
            }
        }
        this.setBoundary(b, d);
    }

    project(u, v, p, div) {
        const n = this.n;
        const h = 1.0 / n;
        for (let j = 1; j <= n; j++) {
            for (let i = 1; i <= n; i++) {
                div[this.IX(i, j)] = -0.5 * h * (u[this.IX(i + 1, j)] - u[this.IX(i - 1, j)] + v[this.IX(i, j + 1)] - v[this.IX(i, j - 1)]);
                p[this.IX(i, j)] = 0;
            }
        }
        this.setBoundary(0, div);
        this.setBoundary(0, p);
        
        this.lin_solve(0, p, div, 1, 4);
        
        for (let j = 1; j <= n; j++) {
            for (let i = 1; i <= n; i++) {
                if (this.obstacles[this.IX(i, j)]) continue;
                u[this.IX(i, j)] -= 0.5 * (p[this.IX(i + 1, j)] - p[this.IX(i - 1, j)]) / h;
                v[this.IX(i, j)] -= 0.5 * (p[this.IX(i, j + 1)] - p[this.IX(i, j - 1)]) / h;
            }
        }
        this.setBoundary(1, u);
        this.setBoundary(2, v);
    }

    step() {
        this.swapU(); this.diffuse(1, this.u, this.u_prev, this.visc);
        this.swapV(); this.diffuse(2, this.v, this.v_prev, this.visc);
        
        this.project(this.u, this.v, this.u_prev, this.v_prev);
        
        this.swapU(); this.swapV();
        this.advect(1, this.u, this.u_prev, this.u_prev, this.v_prev);
        this.advect(2, this.v, this.v_prev, this.u_prev, this.v_prev);
        
        this.project(this.u, this.v, this.u_prev, this.v_prev);
    }

    forceWind(angleDeg, magnitude) {
        const n = this.n;
        const rad = angleDeg * Math.PI / 180;
        const fx = Math.cos(rad) * magnitude;
        const fy = -Math.sin(rad) * magnitude; // 2D y maps to 3D z

        // Inject wind source at boundaries
        for (let i = 1; i <= n; i++) {
            for (let j = 1; j <= n; j++) {
                if (i <= 3 || j <= 3 || i >= n - 2 || j >= n - 2) {
                    if (!this.obstacles[this.IX(i, j)]) {
                        this.u[this.IX(i, j)] = fx;
                        this.v[this.IX(i, j)] = fy;
                    }
                }
            }
        }
    }
}
