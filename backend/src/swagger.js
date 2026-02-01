import fs from 'fs';
import path from 'path';
import yaml from 'yaml';
import swaggerUi from 'swagger-ui-express';

export function mountSwagger(app) {
  const p = path.resolve('docs', 'openapi.yaml');
  const spec = yaml.parse(fs.readFileSync(p, 'utf-8'));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(spec));
}
