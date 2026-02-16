import * as vscode from 'vscode';
import TestFile from '../models/TestFile';
import TestSuite from '../models/TestSuite';
import TestCase from '../models/TestCase';

export const TEST_ITEM_DATA_MAP = new WeakMap<vscode.TestItem, TestFile | TestSuite | TestCase>();
