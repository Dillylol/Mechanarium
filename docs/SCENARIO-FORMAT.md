# Scenario format v1

Mechanarium scenarios are portable JSON documents. Version 1 contains:

- identity: `version`, `id`, `name`, `description`, and optional lesson text;
- numerical policy: `integrator`, `fixedStep`, duration, and world bounds;
- bodies: unique id, shape, mass, size, position, velocity, rotation, inertia, restitution, and color;
- force generators: gravity, uniform force, quadratic drag, anchored spring, and fixed central attraction;
- constraints: ground plane and rolling incline.

The validator rejects unsupported versions, duplicate or missing body ids, invalid mass/size/vector values, unsupported types, and force or constraint references to missing bodies. Serialization validates before producing JSON, and deserialization distinguishes malformed JSON from an invalid scenario contract.

All values use the SI and coordinate conventions in `docs/CONVENTIONS.md`.
