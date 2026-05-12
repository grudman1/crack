import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <motion.div
      className="mx-auto max-w-md px-6 py-16 text-center"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      <div className="paper-card p-8">
        <h1 className="font-display text-3xl uppercase">404</h1>
        <p className="font-hand text-2xl text-ink-soft mt-2">that page isn&apos;t on this notepad</p>
        <Link to="/" className="btn-paper mt-6 inline-block">
          Back to the table
        </Link>
      </div>
    </motion.div>
  );
}
