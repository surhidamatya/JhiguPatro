import Form from './form';

// A server component: it renders on the server, and `Form` (a client component) is rendered there too.
export default function Page() {
  return (
    <main>
      <h1 data-testid="title">jhigu-patro-react in Next.js</h1>
      <Form />
    </main>
  );
}
