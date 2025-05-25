import express from 'express';
import {
  createForm,
  getForm,
  updateForm,
  deleteForm,
  getUserForms,
  getFormTemplates,
} from '../controllers/formController.js';

const router = express.Router();

// Get form templates
router.get('/templates', getFormTemplates);

// Get user's forms
router.get('/user', getUserForms);

// Create new form
router.post('/', createForm);

// Get form by ID
router.get('/:formId', getForm);

// Update form
router.patch('/:formId', updateForm);

// Delete form
router.delete('/:formId', deleteForm);

export default router; 