// Simple Netlify Function example
// Accessible at https://<site>.netlify.app/api/hello
export default async (req, context) => {
  return new Response(
    JSON.stringify({ message: "Hello from Netlify Functions", time: new Date().toISOString() }),
    {
      headers: { "content-type": "application/json" },
      status: 200,
    }
  );
};
