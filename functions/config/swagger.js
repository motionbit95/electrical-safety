const YAML = require("yamljs");
const path = require("path");

// Swagger 문서 로드
const swaggerDocument = YAML.load(path.join(__dirname, "../docs/swagger.yaml"));

module.exports = { swaggerDocument };
