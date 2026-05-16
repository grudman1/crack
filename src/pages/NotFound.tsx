import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  return (
    <motion.div
      className="frame py-16 text-center"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      <h1 className="font-serif text-[44px] font-bold leading-none text-ink">404</h1>
      <p className="mt-4 font-serif italic text-muted">That page isn&apos;t on this notepad.</p>
      <Link to="/" className="btn-primary mt-8 inline-flex">
        Back home
      </Link>
    </motion.div>
  );
}
